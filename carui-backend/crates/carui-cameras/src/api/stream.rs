use axum::{
    body::Body,
    extract::{Path, State, ws::{WebSocketUpgrade, WebSocket, Message}},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use futures_util::StreamExt;
use tokio_stream::wrappers::BroadcastStream;
use std::sync::Arc;
use serde_json::json;

use carui_common::types::WsEvent;
use crate::AppState;

pub async fn mjpeg_stream(
    State(state): State<Arc<AppState>>,
    Path(camera_id): Path<String>,
) -> Response {
    let Some(rx) = state.pipeline.subscribe(&camera_id) else {
        return (StatusCode::NOT_FOUND, "Camera not found").into_response();
    };

    let mut stream = BroadcastStream::new(rx);

    let body = async_stream::stream! {
        let boundary = "frame";
        while let Some(Ok(frame)) = stream.next().await {
            let header = format!(
                "--{}\r\nContent-Type: image/jpeg\r\nContent-Length: {}\r\n\r\n",
                boundary, frame.data.len()
            );
            yield Ok::<_, std::io::Error>(axum::body::Bytes::from(header));
            yield Ok(axum::body::Bytes::from(frame.data.to_vec()));
            yield Ok(axum::body::Bytes::from("\r\n"));
        }
    };

    Response::builder()
        .header(header::CONTENT_TYPE, "multipart/x-mixed-replace; boundary=frame")
        .body(Body::from_stream(body))
        .unwrap()
}

pub async fn snapshot(
    State(state): State<Arc<AppState>>,
    Path(camera_id): Path<String>,
) -> impl IntoResponse {
    let Some(mut rx) = state.pipeline.subscribe(&camera_id) else {
        return (StatusCode::NOT_FOUND, "Camera not found").into_response();
    };

    
    match rx.recv().await {
        Ok(frame) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            frame.data.to_vec()
        ).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "No frame").into_response(),
    }
}

pub async fn recording_status(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({"active": state.pipeline.is_recording()}))
}

pub async fn start_recording(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    state.pipeline.set_recording(true);
    Json(json!({"status": "recording_started"}))
}

pub async fn stop_recording(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    state.pipeline.set_recording(false);

    
    let raw_dir = state.storage.raw_dir();
    let videos_dir = state.storage.videos_dir();
    tokio::spawn(async move {
        crate::converter::convert_all(raw_dir, videos_dir).await;
    });

    Json(json!({"status": "recording_stopped"}))
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>) {
    
    let active = state.pipeline.is_recording();
    let status_event = WsEvent::new("cameras", "recording_status", json!({"active": active}));
    let _ = socket.send(Message::Text(serde_json::to_string(&status_event).unwrap().into())).await;

    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            if text.contains("start_recording") {
                state.pipeline.set_recording(true);
                let event = WsEvent::new("cameras", "recording_started", json!({"active": true}));
                let _ = socket.send(Message::Text(serde_json::to_string(&event).unwrap().into())).await;
            } else if text.contains("stop_recording") {
                state.pipeline.set_recording(false);

                let raw_dir = state.storage.raw_dir();
                let videos_dir = state.storage.videos_dir();
                tokio::spawn(async move {
                    crate::converter::convert_all(raw_dir, videos_dir).await;
                });

                let event = WsEvent::new("cameras", "recording_stopped", json!({"active": false}));
                let _ = socket.send(Message::Text(serde_json::to_string(&event).unwrap().into())).await;
            }
        }
    }
}