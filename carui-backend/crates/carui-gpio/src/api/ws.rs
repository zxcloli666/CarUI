

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};

use carui_common::WsEvent;

use crate::AppState;

pub async fn handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    
    let initial = state.gpio.get_state();
    let event = WsEvent::new("gpio", "state", &initial);
    if let Ok(json) = serde_json::to_string(&event) {
        let _ = tx.send(Message::Text(json.into())).await;
    }

    
    let mut event_rx = state.gpio.subscribe();

    
    let forward_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&event) {
                if tx.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Close(_)) => break,
            Err(_) => break,
            _ => {}
        }
    }

    forward_task.abort();
}
