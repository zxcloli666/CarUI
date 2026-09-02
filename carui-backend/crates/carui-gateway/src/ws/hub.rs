

use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

use carui_common::WsEvent;


#[derive(Clone)]
pub struct ClientConnection {
    pub subscriptions: std::collections::HashSet<String>,
    pub tx: broadcast::Sender<WsEvent>,
}


pub struct Hub {
    
    clients: DashMap<Uuid, Arc<ClientConnection>>,
    
    broadcast_tx: broadcast::Sender<WsEvent>,
}

impl Hub {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(1024);
        Self {
            clients: DashMap::new(),
            broadcast_tx,
        }
    }

    
    pub fn register(&self) -> (Uuid, broadcast::Receiver<WsEvent>) {
        let id = Uuid::new_v4();
        let (tx, _) = broadcast::channel(256);
        let rx = self.broadcast_tx.subscribe();

        let conn = Arc::new(ClientConnection {
            subscriptions: std::collections::HashSet::new(),
            tx,
        });

        self.clients.insert(id, conn);
        tracing::info!("Client {} connected, total: {}", id, self.clients.len());

        (id, rx)
    }

    
    pub fn unregister(&self, id: Uuid) {
        if self.clients.remove(&id).is_some() {
            tracing::info!("Client {} disconnected, total: {}", id, self.clients.len());
        }
    }

    
    pub fn broadcast(&self, event: WsEvent) {
        
        let _ = self.broadcast_tx.send(event);
    }

    
    pub fn broadcast_to_topic(&self, topic: &str, event: WsEvent) {
        for client in self.clients.iter() {
            if client.subscriptions.contains(topic) || client.subscriptions.contains("*") {
                let _ = client.tx.send(event.clone());
            }
        }
    }

    
    pub fn update_subscriptions(&self, id: Uuid, topics: Vec<String>, subscribe: bool) {
        if let Some(mut client) = self.clients.get_mut(&id) {
            let conn = Arc::make_mut(&mut client);
            for topic in topics {
                if subscribe {
                    conn.subscriptions.insert(topic);
                } else {
                    conn.subscriptions.remove(&topic);
                }
            }
        }
    }

    
    pub fn client_count(&self) -> usize {
        self.clients.len()
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}
