pub mod recordings;
pub mod stream;

use axum::{Router, routing::{get, post, delete}};
use std::sync::Arc;
use crate::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/stream/:camera_id", get(stream::mjpeg_stream))
        .route("/snapshot/:camera_id", get(stream::snapshot))
        .route("/recordings", get(recordings::list))
        .route("/recordings/*id", get(recordings::get_file)) 
        .route("/recordings/*id", delete(recordings::delete))
        .route("/record/status", get(stream::recording_status))
        .route("/record/start", post(stream::start_recording))
        .route("/record/stop", post(stream::stop_recording))
        .route("/ws", get(stream::ws_handler))
        .with_state(state)
}