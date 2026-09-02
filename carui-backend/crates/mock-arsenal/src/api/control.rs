

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

use carui_common::{DoorState, WsEvent};

use crate::mock_cameras::CameraSource;
use crate::AppState;





pub async fn gpio_state(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.gpio.get_state())
}

pub async fn set_doors(
    State(state): State<Arc<AppState>>,
    Json(doors): Json<DoorState>,
) -> impl IntoResponse {
    state.gpio.set_doors(doors);
    StatusCode::OK
}

#[derive(Deserialize)]
pub struct ReverseRequest {
    active: bool,
}

pub async fn set_reverse(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ReverseRequest>,
) -> impl IntoResponse {
    state.gpio.set_reverse(req.active);
    StatusCode::OK
}

#[derive(Deserialize)]
pub struct ParkingRequest {
    sensors: Vec<u32>,
}

pub async fn set_parking(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ParkingRequest>,
) -> impl IntoResponse {
    
    state.gpio.set_parking(req.sensors.clone());
    state.parking.set_all_sensors(req.sensors);
    StatusCode::OK
}

pub async fn parking_state(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.parking.get_state())
}





pub async fn gps_position(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.gps.get_position())
}

#[derive(Deserialize)]
pub struct PositionRequest {
    lat: f64,
    lon: f64,
    bearing: f32,
    speed: f32,
}

pub async fn set_gps_position(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PositionRequest>,
) -> impl IntoResponse {
    state.gps.set_position(req.lat, req.lon, req.bearing, req.speed);
    StatusCode::OK
}

pub async fn load_gpx(
    State(state): State<Arc<AppState>>,
    body: String,
) -> impl IntoResponse {
    match state.gps.load_gpx(&body) {
        Ok(count) => Json(serde_json::json!({ "points": count })).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

#[derive(Deserialize)]
pub struct GpsControlRequest {
    action: String,
    
    #[serde(default)]
    multiplier: Option<f32>,
    
    #[serde(default)]
    speed_ms: Option<f64>,
}

pub async fn gps_control(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GpsControlRequest>,
) -> impl IntoResponse {
    match req.action.as_str() {
        "start" => state.gps.start_playback(),
        "pause" => state.gps.pause_playback(),
        "reset" => state.gps.reset_playback(),
        "speed" => {
            if let Some(mult) = req.multiplier {
                state.gps.set_speed_multiplier(mult);
            }
        }
        "set_speed" => {
            if let Some(speed) = req.speed_ms {
                state.gps.set_speed(speed);
            }
        }
        _ => {}
    }
    StatusCode::OK
}






pub async fn camera_list(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(state.cameras.get_all())
}


#[derive(Serialize)]
pub struct CameraStatusResponse {
    cameras: Vec<CameraStatusItem>,
}

#[derive(Serialize)]
pub struct CameraStatusItem {
    id: String,
    streaming: bool,
    source: Option<CameraSource>,
}

pub async fn camera_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let status = state.v4l2_streams.status();
    let cameras: Vec<CameraStatusItem> = state
        .cameras
        .list()
        .into_iter()
        .map(|id| {
            let streaming = status.get(&id).copied().unwrap_or(false);
            let source = state.v4l2_streams.get(&id).and_then(|s| s.get_source());
            CameraStatusItem {
                id,
                streaming,
                source,
            }
        })
        .collect();

    Json(CameraStatusResponse { cameras })
}

#[derive(Deserialize)]
pub struct CameraSourceRequest {
    
    #[serde(default)]
    path: Option<String>,
    
    #[serde(default)]
    camera_id: Option<String>,
}


pub async fn set_camera_source(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CameraSourceRequest>,
) -> impl IntoResponse {
    let source = match req.path {
        Some(path) if !path.is_empty() => CameraSource::VideoFile(path),
        _ => CameraSource::TestPattern,
    };

    match req.camera_id {
        Some(id) => {
            
            if state.cameras.set_source(&id, source.clone()) {
                if let Err(e) = state.v4l2_streams.set_source(&id, &source) {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": e.to_string() })),
                    )
                        .into_response();
                }
            } else {
                return (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({ "error": "Camera not found" })),
                )
                    .into_response();
            }
        }
        None => {
            
            state.cameras.set_all_source(source.clone());
            state.v4l2_streams.set_all_source(&source);
        }
    }

    Json(serde_json::json!({ "ok": true })).into_response()
}





pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(|socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    
    let mut gpio_rx = state.gpio.subscribe();
    let mut gps_rx = state.gps.subscribe();

    
    let gpio_state = state.gpio.get_state();
    let event = WsEvent::new("gpio", "state", &gpio_state);
    if let Ok(json) = serde_json::to_string(&event) {
        let _ = tx.send(Message::Text(json.into())).await;
    }

    let gps_pos = state.gps.get_position();
    let event = WsEvent::new("gps", "position", &gps_pos);
    if let Ok(json) = serde_json::to_string(&event) {
        let _ = tx.send(Message::Text(json.into())).await;
    }

    
    loop {
        tokio::select! {
            Some(msg) = rx.next() => {
                match msg {
                    Ok(Message::Close(_)) => break,
                    Err(_) => break,
                    _ => {}
                }
            }
            Ok(event) = gpio_rx.recv() => {
                if let Ok(json) = serde_json::to_string(&event) {
                    if tx.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
            Ok(event) = gps_rx.recv() => {
                if let Ok(json) = serde_json::to_string(&event) {
                    if tx.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    }
}