

use parking_lot::RwLock;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::broadcast;
use tokio_serial::SerialPortBuilderExt;

use carui_common::{ClientGpsData, GpsPosition, GpsSource, WsEvent};

pub struct GpsProvider {
    
    ublox_position: Arc<RwLock<GpsPosition>>,
    
    client_position: Arc<RwLock<Option<GpsPosition>>>,

    port_path: String,
    event_tx: broadcast::Sender<WsEvent>,
}

impl GpsProvider {
    pub fn new(port_path: &str) -> Self {
        let (event_tx, _) = broadcast::channel(256);
        Self {
            ublox_position: Arc::new(RwLock::new(GpsPosition::default())),
            client_position: Arc::new(RwLock::new(None)),
            port_path: port_path.to_string(),
            event_tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    
    pub fn update_client_position(&self, data: ClientGpsData) {
        let now = Self::now_ms();
        let pos = GpsPosition {
            lat: data.lat,
            lon: data.lon,
            bearing: data.bearing,
            speed_ms: data.speed_kmh / 3.6,
            timestamp: now,
            source: GpsSource::Client,
        };
        *self.client_position.write() = Some(pos);

        
        
        
        
        let ublox_active = {
            let u = self.ublox_position.read();
            u.source == GpsSource::UBlox && (now.saturating_sub(u.timestamp) < 2000)
        };

        if !ublox_active {
            
            if let Some(client_pos) = self.client_position.read().as_ref() {
                let event = WsEvent::new("speed", "position", client_pos);
                let _ = self.event_tx.send(event);
            }
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    
    pub fn get_position(&self) -> GpsPosition {
        let now = Self::now_ms();

        
        let ublox = self.ublox_position.read().clone();
        if ublox.source == GpsSource::UBlox && (now.saturating_sub(ublox.timestamp)) < 2000 {
            return ublox;
        }

        
        let client_lock = self.client_position.read();
        if let Some(client) = client_lock.as_ref() {
            if (now.saturating_sub(client.timestamp)) < 5000 {
                return client.clone();
            }
        }

        
        ublox
    }

    pub async fn run_loop(&self) {
        loop {
            
            if let Err(e) = self.read_serial().await {
                tracing::warn!("GPS serial error: {}, retry in 5s", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    }

    async fn read_serial(&self) -> anyhow::Result<()> {
        let port = tokio_serial::new(&self.port_path, 9600).open_native_async()?;
        let mut reader = BufReader::new(port);
        let mut parser = nmea_parser::NmeaParser::new();
        let mut line = String::new();

        tracing::info!("GPS connected on {}", self.port_path);

        loop {
            line.clear();
            reader.read_line(&mut line).await?;

            match parser.parse_sentence(&line) {
                Ok(nmea) => {
                    use nmea_parser::ParsedMessage::*;
                    match nmea {
                        Gga(gga) => {
                            if let (Some(lat), Some(lon)) = (gga.latitude, gga.longitude) {
                                let mut pos = self.ublox_position.write();
                                pos.lat = lat;
                                pos.lon = lon;
                                pos.source = GpsSource::UBlox;
                                pos.timestamp = Self::now_ms();
                                
                                let event = WsEvent::new("speed", "position", &*pos);
                                let _ = self.event_tx.send(event);
                            }
                        }
                        Rmc(rmc) => {
                            let mut pos = self.ublox_position.write();
                            if let Some(bearing) = rmc.bearing {
                                pos.bearing = bearing as f32;
                            }
                            if let Some(sog) = rmc.sog_knots {
                                pos.speed_ms = (sog * 0.514444) as f32;
                            }
                        }
                        _ => {}
                    }
                }
                Err(_) => {} 
            }
        }
    }
}
