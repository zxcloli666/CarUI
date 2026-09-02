









use std::sync::Arc;

use axum::{routing::get, Router};
use tower_http::cors::CorsLayer;

mod api;
mod config;
mod gpio;

use config::Config;
use gpio::GpioManager;

pub struct AppState {
    pub config: Config,
    pub gpio: GpioManager,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    carui_common::config::init_tracing();

    let config: Config = carui_common::load_config("gpio")?;

    tracing::info!("Starting CarUI GPIO Service on {}", config.listen_addr);
    tracing::info!("  GPIO chip: {}", config.gpio_chip);
    tracing::info!("  Parking UART: {}", config.parking.port);

    let gpio = GpioManager::new(&config)?;

    let state = Arc::new(AppState {
        config: config.clone(),
        gpio,
    });

    
    let monitor_state = state.clone();
    tokio::spawn(async move {
        monitor_state.gpio.run_monitor_loop().await;
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/state", get(api::http::get_state))
        .route("/doors", get(api::http::get_doors))
        .route("/reverse", get(api::http::get_reverse))
        .route("/parking", get(api::http::get_parking))
        .route("/ws", get(api::ws::handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("GPIO service listening on {}", config.listen_addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
