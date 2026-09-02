













use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;

mod api;
mod config;
mod mock_cameras;
mod mock_gpio;
mod mock_gps;
mod mock_parking;
mod v4l2_output;
mod web_ui;

use config::Config;
use mock_cameras::{CameraConfig, CameraSource, MockCameras};
use mock_gpio::MockGpio;
use mock_gps::MockGps;
use mock_parking::{MockParking, MockSensorDef};
use v4l2_output::V4l2StreamManager;

pub struct AppState {
    pub config: Config,
    pub gpio: MockGpio,
    pub parking: Arc<MockParking>,
    pub cameras: Arc<MockCameras>,
    pub gps: Arc<MockGps>,
    pub v4l2_streams: Arc<V4l2StreamManager>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    carui_common::config::init_tracing();

    let config: Config = carui_common::load_config("mock").unwrap_or_default();

    tracing::info!("Starting Mock Arsenal on {}", config.listen_addr);

    
    let gpio = MockGpio::with_config(
        config.gpio.chip.clone(),
        config.gpio.door_pins,
        config.gpio.reverse_pin,
    );

    
    let sensor_defs: Vec<MockSensorDef> = config
        .parking
        .sensors
        .iter()
        .map(|s| MockSensorDef {
            position: s.position,
            uart_index: s.uart_index,
        })
        .collect();

    let parking = Arc::new(if sensor_defs.is_empty() {
        tracing::warn!("No parking sensors configured, using default 4 rear sensors");
        MockParking::new(4)
    } else {
        tracing::info!("Parking sensors from config: {} sensors", sensor_defs.len());
        MockParking::with_sensors(sensor_defs)
    });

    
    let gps = Arc::new(MockGps::new());

    
    let camera_configs: Vec<CameraConfig> = config
        .v4l2_devices
        .iter()
        .map(|d| CameraConfig {
            id: d.camera_id.clone(),
            device: d.device.clone(),
            width: 1280,
            height: 720,
            fps: 30,
        })
        .collect();

    
    let cameras = Arc::new(MockCameras::new(
        &camera_configs,
        config.video_path.as_deref(),
    ));

    
    let v4l2_streams = Arc::new(V4l2StreamManager::new(&config.v4l2_devices, 1280, 720, 30));

    
    let streams_for_callback = v4l2_streams.clone();
    cameras.set_on_source_change(move |camera_id, source| {
        if let Err(e) = streams_for_callback.set_source(camera_id, source) {
            tracing::warn!("Failed to update v4l2 stream for {}: {}", camera_id, e);
        }
    });

    
    let v4l2_available = v4l2_streams.available_devices();
    if !v4l2_available.is_empty() {
        tracing::info!("===========================================");
        tracing::info!("V4L2 loopback devices available:");
        for cam_id in &v4l2_available {
            tracing::info!("  {} -> ready", cam_id);
        }
        tracing::info!("===========================================");

        
        let initial_source = match &config.video_path {
            Some(path) => CameraSource::VideoFile(path.clone()),
            None => CameraSource::TestPattern,
        };
        v4l2_streams.start_all(&initial_source);
    } else {
        tracing::warn!("===========================================");
        tracing::warn!("No V4L2 loopback devices available!");
        tracing::warn!("Run: sudo modprobe v4l2loopback devices=4 video_nr=10,11,12,13 exclusive_caps=0");
        tracing::warn!("===========================================");
    }

    
    if let Some(pty_path) = gps.get_pty_path() {
        tracing::info!("===========================================");
        tracing::info!("GPS PTY available at: {}", pty_path.display());
        tracing::info!("Configure carui-speed: gps_port = \"{}\"", pty_path.display());
        tracing::info!("===========================================");
    }

    
    if let Some(pty_path) = parking.get_pty_path() {
        tracing::info!("===========================================");
        tracing::info!("Parking UART PTY available at: {}", pty_path.display());
        tracing::info!("Configure carui-gpio: parking_port = \"{}\"", pty_path.display());
        tracing::info!("===========================================");
    }

    
    let gps_loop = gps.clone();
    tokio::spawn(async move {
        gps_loop.run_playback_loop().await;
    });

    
    let parking_loop = parking.clone();
    tokio::spawn(async move {
        parking_loop.run_output_loop().await;
    });

    let state = Arc::new(AppState {
        config: config.clone(),
        gpio,
        parking,
        cameras,
        gps,
        v4l2_streams,
    });

    let app = Router::new()
        
        .route("/", get(web_ui::index))
        .route("/static/*path", get(web_ui::static_file))
        
        .route("/api/gpio/state", get(api::control::gpio_state))
        .route("/api/gpio/doors", post(api::control::set_doors))
        .route("/api/gpio/reverse", post(api::control::set_reverse))
        .route("/api/gpio/parking", get(api::control::parking_state))
        .route("/api/gpio/parking", post(api::control::set_parking))
        
        .route("/api/gps/position", get(api::control::gps_position))
        .route("/api/gps/position", post(api::control::set_gps_position))
        .route("/api/gps/gpx", post(api::control::load_gpx))
        .route("/api/gps/control", post(api::control::gps_control))
        
        .route("/api/cameras", get(api::control::camera_list))
        .route("/api/cameras/status", get(api::control::camera_status))
        .route("/api/cameras/source", post(api::control::set_camera_source))
        
        .route("/ws", get(api::control::ws_handler))
        
        .route("/health", get(|| async { "ok" }))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("Mock Arsenal listening on http://{}", config.listen_addr);

    axum::serve(listener, app).await?;

    Ok(())
}