

use std::sync::Arc;
use axum::{extract::{State, Json}, response::IntoResponse};
use carui_common::{GpsPosition, WsEvent};
use serde::{Deserialize};
use crate::{AppState, matching::MapMatcher};

#[derive(Deserialize)]
pub struct CalcRequest {
    pub lat: f64,
    pub lon: f64,
    pub bearing: f32,
}


pub async fn get_gps(State(state): State<Arc<AppState>>) -> Json<GpsPosition> {
    Json(state.gps.get_position())
}


pub async fn calculate_speed(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CalcRequest>
) -> impl IntoResponse {
    state.osm.check_and_fetch(payload.lat, payload.lon, &state.db, &state.rtree).await;

    let rtree = state.rtree.read().await;
    let mut matcher = MapMatcher::new();

    let info = matcher.match_position(payload.lat, payload.lon, payload.bearing, &rtree);

    let event = WsEvent::new("speed", "speed_limit", &info);
    Json(event)
}