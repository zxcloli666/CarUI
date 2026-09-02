

use std::sync::Arc;
use axum::{extract::{ws::{Message, WebSocket}, State, WebSocketUpgrade}, response::Response};
use futures_util::{SinkExt, StreamExt};
use futures_util::stream::SplitSink;
use serde::{Deserialize, Serialize};
use carui_common::{ClientGpsData, WsEvent, SpeedChange};

use crate::matching::MapMatcher;
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    Position(ClientGpsData),
    Preload { lat: f64, lon: f64 },
}

#[derive(Serialize)]
struct SpeedResponse {
    limit: i32,
    gps_source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_change: Option<SpeedChange>,
}

pub async fn handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();
    let mut matcher = MapMatcher::new();

    
    let initial_pos = state.gps.get_position();
    if initial_pos.lat != 0.0 {
        let event = WsEvent::new("speed", "position", &initial_pos);
        if let Ok(json) = serde_json::to_string(&event) {
            let _ = tx.send(Message::Text(json.into())).await;
        }
    }

    let mut gps_rx = state.gps.subscribe();

    loop {
        tokio::select! {
            
            Ok(event) = gps_rx.recv() => {
                
                if let Ok(json) = serde_json::to_string(&event) {
                    if tx.send(Message::Text(json.into())).await.is_err() { break; }
                }

                
                if let Some(pos_data) = event.data.as_object() {
                     if let (Some(lat), Some(lon), Some(bearing)) = (
                         pos_data.get("lat").and_then(|v| v.as_f64()),
                         pos_data.get("lon").and_then(|v| v.as_f64()),
                         pos_data.get("bearing").and_then(|v| v.as_f64())
                     ) {
                         process_matching(lat, lon, bearing as f32, &state, &mut matcher, &mut tx).await;
                     }
                }
            }

            
            msg = rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) else { continue; };
                        match client_msg {
                            ClientMessage::Position(gps) => {
                                
                                
                                
                                state.gps.update_client_position(gps);
                            }
                            ClientMessage::Preload { lat, lon } => {
                                let osm = state.osm.clone();
                                let db = state.db.clone();
                                let rtree = state.rtree.clone();
                                tokio::spawn(async move {
                                    osm.check_and_fetch(lat, lon, &db, &rtree).await;
                                });
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}

async fn process_matching(
    lat: f64,
    lon: f64,
    bearing: f32,
    state: &AppState,
    matcher: &mut MapMatcher,
    tx: &mut SplitSink<WebSocket, Message>
) {
    let rtree = state.rtree.read().await;
    let info = matcher.match_position(lat, lon, bearing, &rtree);

    let resp = SpeedResponse {
        limit: info.limit,
        gps_source: state.gps.get_position().source.as_str().to_string(),
        next_change: info.next_change,
    };

    let event = WsEvent::new("speed", "speed_limit", &resp);
    if let Ok(json) = serde_json::to_string(&event) {
        let _ = tx.send(Message::Text(json.into())).await;
    }
}