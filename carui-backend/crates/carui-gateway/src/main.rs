




use std::sync::Arc;

use axum::{
    routing::{any, get},
    Router,
};
use tower_http::cors::CorsLayer;

mod config;
mod proxy;
mod subscriber;
mod ws;

use config::Config;
use ws::Hub;

pub struct AppState {
    pub config: Config,
    pub hub: Hub,
    pub http_client: reqwest::Client,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    carui_common::config::init_tracing();

    let config: Config = carui_common::load_config("gateway")?;

    tracing::info!("Starting CarUI Gateway on {}", config.listen_addr);

    let hub = Hub::new();
    let http_client = reqwest::Client::new();

    let state = Arc::new(AppState {
        config: config.clone(),
        hub,
        http_client,
    });

    
    let subscriber_state = state.clone();
    tokio::spawn(async move {
        subscriber::run(subscriber_state).await;
    });

    let app = Router::new()
        
        .route("/ws", get(ws::handler))
        
        .route("/health", get(health))
        
        .route("/api/gpio/*path", any(proxy::gpio))
        .route("/api/cameras/*path", any(proxy::cameras))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("Gateway listening on {}", config.listen_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
