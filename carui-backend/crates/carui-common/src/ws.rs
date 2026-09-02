

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{de::DeserializeOwned, Serialize};
use tokio::sync::broadcast;


#[derive(Debug, thiserror::Error)]
pub enum WsError {
    #[error("Connection closed")]
    ConnectionClosed,
    #[error("Send failed: {0}")]
    SendFailed(String),
    #[error("Invalid message format: {0}")]
    InvalidFormat(String),
}


pub async fn send_json<T: Serialize>(
    socket: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    data: &T,
) -> Result<(), WsError> {
    let json = serde_json::to_string(data).map_err(|e| WsError::InvalidFormat(e.to_string()))?;
    socket
        .send(Message::Text(json.into()))
        .await
        .map_err(|e| WsError::SendFailed(e.to_string()))
}


pub async fn recv_json<T: DeserializeOwned>(
    socket: &mut futures_util::stream::SplitStream<WebSocket>,
) -> Result<Option<T>, WsError> {
    match socket.next().await {
        Some(Ok(Message::Text(text))) => {
            let data: T =
                serde_json::from_str(&text).map_err(|e| WsError::InvalidFormat(e.to_string()))?;
            Ok(Some(data))
        }
        Some(Ok(Message::Close(_))) | None => Ok(None),
        Some(Ok(_)) => Ok(None), 
        Some(Err(e)) => Err(WsError::SendFailed(e.to_string())),
    }
}


pub struct WsBroadcast<T> {
    tx: broadcast::Sender<T>,
}

impl<T: Clone + Send + 'static> WsBroadcast<T> {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<T> {
        self.tx.subscribe()
    }

    pub fn send(&self, value: T) -> Result<usize, broadcast::error::SendError<T>> {
        self.tx.send(value)
    }

    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

impl<T: Clone + Send + 'static> Default for WsBroadcast<T> {
    fn default() -> Self {
        Self::new(256)
    }
}


#[derive(Clone, Debug, Serialize)]
pub struct TaggedMessage<T> {
    pub topic: String,
    #[serde(flatten)]
    pub data: T,
}

impl<T> TaggedMessage<T> {
    pub fn new(topic: impl Into<String>, data: T) -> Self {
        Self {
            topic: topic.into(),
            data,
        }
    }
}


#[derive(Clone, Debug, Default)]
pub struct Subscriptions {
    pub topics: std::collections::HashSet<String>,
}

impl Subscriptions {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn subscribe(&mut self, topic: &str) {
        self.topics.insert(topic.to_string());
    }

    pub fn unsubscribe(&mut self, topic: &str) {
        self.topics.remove(topic);
    }

    pub fn is_subscribed(&self, topic: &str) -> bool {
        self.topics.contains(topic) || self.topics.contains("*")
    }

    pub fn subscribe_all(&mut self) {
        self.topics.insert("*".to_string());
    }
}


#[derive(Clone, Debug, serde::Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum SubscriptionCommand {
    Subscribe { topics: Vec<String> },
    Unsubscribe { topics: Vec<String> },
    SubscribeAll,
}

impl SubscriptionCommand {
    pub fn apply(&self, subs: &mut Subscriptions) {
        match self {
            SubscriptionCommand::Subscribe { topics } => {
                for topic in topics {
                    subs.subscribe(topic);
                }
            }
            SubscriptionCommand::Unsubscribe { topics } => {
                for topic in topics {
                    subs.unsubscribe(topic);
                }
            }
            SubscriptionCommand::SubscribeAll => {
                subs.subscribe_all();
            }
        }
    }
}


pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}


pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
