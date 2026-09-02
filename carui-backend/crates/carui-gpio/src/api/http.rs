

use std::sync::Arc;

use axum::{extract::State, Json};

use crate::gpio::GpioState;
use crate::AppState;
use carui_common::{DoorState, ParkingState};

pub async fn get_state(State(state): State<Arc<AppState>>) -> Json<GpioState> {
    Json(state.gpio.get_state())
}

pub async fn get_doors(State(state): State<Arc<AppState>>) -> Json<DoorState> {
    Json(state.gpio.get_doors())
}

pub async fn get_reverse(State(state): State<Arc<AppState>>) -> Json<bool> {
    Json(state.gpio.get_reverse())
}

pub async fn get_parking(State(state): State<Arc<AppState>>) -> Json<ParkingState> {
    Json(state.gpio.get_parking())
}
