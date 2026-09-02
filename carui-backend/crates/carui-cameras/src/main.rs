use std::sync::Arc;
use tokio::signal;
use carui_common::config::load_config;
use tower_http::cors::CorsLayer;

mod api;
mod capture;
mod config;
mod converter;
mod overlay;
mod pipeline;
mod recorder;
mod storage;

use config::Config;
use pipeline::Pipeline;
use storage::StorageManager;

pub struct AppState {
    pub pipeline: Arc<Pipeline>,
    pub storage: Arc<StorageManager>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    carui_common::config::init_tracing();

    let config: Config = load_config("cameras")?;

    let storage = Arc::new(StorageManager::new(
        &config.recordings_path,
        config.max_storage_gb
    )?);

    
    let raw_dir = storage.raw_dir();
    let videos_dir = storage.videos_dir();
    tokio::spawn(async move {
        converter::convert_all(raw_dir, videos_dir).await;
    });

    
    let storage_clone = storage.clone();
    tokio::spawn(async move {
        storage_clone.run_cleanup_loop().await;
    });

    let pipeline = Pipeline::new(config.clone());
    pipeline.start();

    let state = Arc::new(AppState {
        pipeline: pipeline.clone(),
        storage,
    });

    let app = api::router(state.clone())
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("Service listening on {}", config.listen_addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(pipeline))
        .await?;

    Ok(())
}

async fn shutdown_signal(pipeline: Arc<Pipeline>) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::warn!("Shutdown signal received...");
    pipeline.stop();
}