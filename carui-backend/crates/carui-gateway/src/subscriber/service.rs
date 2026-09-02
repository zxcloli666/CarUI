

use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;

use carui_common::WsEvent;

use crate::AppState;


pub async fn run(state: Arc<AppState>) {
    let services = [
        ("gpio", state.config.services.gpio.clone()),
        ("speed", state.config.services.speed.clone()),
        ("cameras", state.config.services.cameras.clone()),
    ];

    let mut handles = Vec::new();

    for (name, base_url) in services {
        let state = state.clone();
        let ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://");
        let ws_url = format!("{}/ws", ws_url);

        let handle = if name == "speed" {
            
            tokio::spawn(async move {
                subscribe_to_speed_service(&ws_url, state).await;
            })
        } else {
            tokio::spawn(async move {
                subscribe_to_service(name, &ws_url, state).await;
            })
        };

        handles.push(handle);
    }

    
    for handle in handles {
        let _ = handle.await;
    }
}

async fn subscribe_to_service(name: &str, ws_url: &str, state: Arc<AppState>) {
    loop {
        tracing::info!("Connecting to {} at {}", name, ws_url);

        match connect_async(ws_url).await {
            Ok((ws_stream, _)) => {
                tracing::info!("Connected to {}", name);

                let (_, mut read) = ws_stream.split();

                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                            if let Ok(event) = serde_json::from_str::<WsEvent>(&text) {
                                state.hub.broadcast(event);
                            } else {
                                
                                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                                    let event = WsEvent::new(name, "update", data);
                                    state.hub.broadcast(event);
                                }
                            }
                        }
                        Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                            tracing::info!("Connection to {} closed", name);
                            break;
                        }
                        Err(e) => {
                            tracing::warn!("Error from {}: {}", name, e);
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to connect to {}: {}", name, e);
            }
        }

        
        tracing::info!("Reconnecting to {} in 5 seconds...", name);
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}



async fn subscribe_to_speed_service(ws_url: &str, state: Arc<AppState>) {
    loop {
        tracing::info!("Connecting to speed at {}", ws_url);

        match connect_async(ws_url).await {
            Ok((ws_stream, _)) => {
                tracing::info!("Connected to speed");

                let (mut write, mut read) = ws_stream.split();
                let mut position_rx = state.position_tx.subscribe();

                loop {
                    tokio::select! {
                        
                        msg = read.next() => {
                            match msg {
                                Some(Ok(tokio_tungstenite::tungstenite::Message::Text(text))) => {
                                    if let Ok(event) = serde_json::from_str::<WsEvent>(&text) {
                                        state.hub.broadcast(event);
                                    } else if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                                        let event = WsEvent::new("speed", "update", data);
                                        state.hub.broadcast(event);
                                    }
                                }
                                Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))) => {
                                    tracing::info!("Connection to speed closed");
                                    break;
                                }
                                Some(Err(e)) => {
                                    tracing::warn!("Error from speed: {}", e);
                                    break;
                                }
                                None => break,
                                _ => {}
                            }
                        }

                        
                        Ok(pos_msg) = position_rx.recv() => {
                            if let Err(e) = write.send(tokio_tungstenite::tungstenite::Message::Text(pos_msg.into())).await {
                                tracing::warn!("Failed to send position to speed: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to connect to speed: {}", e);
            }
        }

        
        tracing::info!("Reconnecting to speed in 5 seconds...");
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}
