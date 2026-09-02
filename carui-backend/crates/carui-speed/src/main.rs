

use std::sync::Arc;

use axum::{routing::get, Router};
use axum::routing::post;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use carui_common::geo::lat_lon_to_tile;

mod api;
mod config;
mod db;
mod gps;
mod osm;
mod matching;

use config::Config;
use db::Database;
use gps::GpsProvider;
use osm::OsmManager;
use matching::RTreeIndex;

pub struct AppState {
    pub config: Config,
    pub db: Arc<Database>,
    pub rtree: Arc<RwLock<RTreeIndex>>,
    pub gps: Arc<GpsProvider>,
    pub osm: Arc<OsmManager>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    carui_common::config::init_tracing();

    let config: Config = carui_common::load_config("speed")?;

    tracing::info!("Starting CarUI Speed Service (Overpass) on {}", config.listen_addr);

    
    let db = Arc::new(Database::open(&config.db_path)?);
    db.migrate()?;

    
    let rtree = Arc::new(RwLock::new(RTreeIndex::load_from_db(&db)?));

    
    let gps = Arc::new(GpsProvider::new(&config.gps_port));

    
    let osm = Arc::new(OsmManager::new(
        config.overpass_url.clone(),
        config.tile_ttl_days
    ));

    let state = Arc::new(AppState {
        config: config.clone(),
        db,
        rtree,
        gps: gps.clone(),
        osm,
    });

    
    let gps_runner = state.gps.clone();
    tokio::spawn(async move {
        gps_runner.run_loop().await;
    });

    
    
    let updater_state = state.clone();
    tokio::spawn(async move {
        let mut rx = updater_state.gps.subscribe();

        
        let mut last_tile: Option<(i32, i32)> = None;

        while let Ok(event) = rx.recv().await {
            if let Some(data) = event.data.as_object() {
                let lat_opt = data.get("lat").and_then(|v: &serde_json::Value| v.as_f64());
                let lon_opt = data.get("lon").and_then(|v: &serde_json::Value| v.as_f64());

                if let (Some(lat), Some(lon)) = (lat_opt, lon_opt) {

                    
                    let (tx, ty) = lat_lon_to_tile(lat, lon, 12);
                    let current_tile = (tx, ty);

                    
                    
                    

                    let need_fetch = match last_tile {
                        Some(t) => t != current_tile, 
                        None => true, 
                    };

                    if need_fetch {
                        tracing::info!("Entered new tile region: {}/{}. Triggering fetch.", tx, ty);
                        last_tile = Some(current_tile);

                        let osm = updater_state.osm.clone();
                        let db = updater_state.db.clone();
                        let rtree = updater_state.rtree.clone();

                        tokio::spawn(async move {
                            
                            
                            osm.check_and_fetch(lat, lon, &db, &rtree).await;
                        });
                    }
                }
            }
        }
    });

    
    let app = Router::new()
        .route("/health", get(health))
        .route("/gps", get(api::http::get_gps))
        .route("/calculate", post(api::http::calculate_speed))
        .route("/ws", get(api::ws::handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("Speed service listening on {}", config.listen_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> &'static str {
    "ok"
}