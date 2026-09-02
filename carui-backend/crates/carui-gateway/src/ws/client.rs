

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;

use carui_common::WsEvent;

use crate::AppState;


#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    Subscribe { topics: Vec<String> },
    Unsubscribe { topics: Vec<String> },
    Ping,
}

pub async fn handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut tx, mut rx) = socket.split();

    
    let (client_id, mut broadcast_rx) = state.hub.register();

    
    let welcome = WsEvent::new("system", "connected", serde_json::json!({
        "client_id": client_id.to_string(),
        "message": "Connected to CarUI Gateway"
    }));

    if let Ok(json) = serde_json::to_string(&welcome) {
        let _ = tx.send(Message::Text(json.into())).await;
    }

    
    let forward_task = tokio::spawn(async move {
        while let Ok(event) = broadcast_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&event) {
                if tx.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Subscribe { topics } => {
                            state.hub.update_subscriptions(client_id, topics, true);
                        }
                        ClientMessage::Unsubscribe { topics } => {
                            state.hub.update_subscriptions(client_id, topics, false);
                        }
                        ClientMessage::Ping => {
                            
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(_) => break,
            _ => {}
        }
    }

    
    forward_task.abort();
    state.hub.unregister(client_id);
}
