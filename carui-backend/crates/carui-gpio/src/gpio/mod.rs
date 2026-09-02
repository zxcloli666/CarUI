






mod doors;
mod parking;
mod reverse;

use std::sync::Arc;

use parking_lot::RwLock;
use tokio::sync::broadcast;

use carui_common::{DoorState, ParkingState, WsEvent};

use crate::config::Config;

pub use doors::DoorMonitor;
pub use parking::ParkingMonitor;
pub use reverse::ReverseMonitor;


#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct GpioState {
    pub doors: DoorState,
    pub reverse: bool,
    pub parking: ParkingState,
}


#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum GpioEvent {
    Doors(DoorState),
    Reverse(bool),
    Parking(ParkingState),
}


pub struct GpioManager {
    state: Arc<RwLock<GpioState>>,
    event_tx: broadcast::Sender<WsEvent>,
    doors: Option<DoorMonitor>,
    reverse: Option<ReverseMonitor>,
    parking: ParkingMonitor,
}

impl GpioManager {
    pub fn new(config: &Config) -> anyhow::Result<Self> {
        let (event_tx, _) = broadcast::channel(256);
        let state = Arc::new(RwLock::new(GpioState::default()));

        
        let doors = match DoorMonitor::new(&config.gpio_chip, &config.doors) {
            Ok(d) => Some(d),
            Err(e) => {
                tracing::warn!("Failed to initialize door monitor: {} - doors disabled", e);
                None
            }
        };

        
        let reverse = match ReverseMonitor::new(&config.gpio_chip, &config.reverse) {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!(
                    "Failed to initialize reverse monitor: {} - reverse disabled",
                    e
                );
                None
            }
        };

        
        let parking = ParkingMonitor::new(&config.parking)?;

        Ok(Self {
            state,
            event_tx,
            doors,
            reverse,
            parking,
        })
    }

    pub fn get_state(&self) -> GpioState {
        self.state.read().clone()
    }

    pub fn get_doors(&self) -> DoorState {
        self.state.read().doors.clone()
    }

    pub fn get_reverse(&self) -> bool {
        self.state.read().reverse
    }

    pub fn get_parking(&self) -> ParkingState {
        self.state.read().parking.clone()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    pub async fn run_monitor_loop(&self) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(50));
        let mut parking_counter: u32 = 0;

        loop {
            interval.tick().await;

            
            if let Some(ref doors) = self.doors {
                let door_state = doors.read_state();
                let doors_changed = {
                    let mut state = self.state.write();
                    let changed = state.doors != door_state;
                    if changed {
                        state.doors = door_state.clone();
                    }
                    changed
                };

                if doors_changed {
                    let event = WsEvent::new("gpio", "doors", &door_state);
                    let _ = self.event_tx.send(event);
                }
            }

            
            let is_reverse = if let Some(ref reverse) = self.reverse {
                let reverse_state = reverse.read_state();
                let reverse_changed = {
                    let mut state = self.state.write();
                    let changed = state.reverse != reverse_state;
                    if changed {
                        state.reverse = reverse_state;
                    }
                    changed
                };

                if reverse_changed {
                    let event = WsEvent::new("gpio", "reverse", &reverse_state);
                    let _ = self.event_tx.send(event);
                }
                reverse_state
            } else {
                self.state.read().reverse
            };

            
            
            
            parking_counter += 1;
            let parking_interval = if is_reverse { 2 } else { 4 };
            if parking_counter % parking_interval == 0 {
                let parking = self.parking.read_state().await;
                {
                    let mut state = self.state.write();
                    state.parking = parking.clone();
                }
                let event = WsEvent::new("gpio", "parking", &parking);
                let _ = self.event_tx.send(event);
            }
        }
    }
}
