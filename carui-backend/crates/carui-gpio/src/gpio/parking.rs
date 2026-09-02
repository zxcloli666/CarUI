














use std::sync::Arc;
use std::time::Duration;

use carui_common::{ParkingSensor, ParkingState, SensorPosition};
use parking_lot::RwLock;
use tokio_serial::SerialPortBuilderExt;

use crate::config::{ParkingConfig, SensorDef};


#[derive(Clone, Debug)]
struct SensorReading {
    
    uart_index: u8,
    
    position: SensorPosition,
    
    distance_cm: u32,
    
    #[allow(dead_code)]
    last_update: std::time::Instant,
}

pub struct ParkingMonitor {
    
    sensors: Vec<SensorDef>,
    
    readings: Arc<RwLock<Vec<SensorReading>>>,
}

impl ParkingMonitor {
    pub fn new(config: &ParkingConfig) -> anyhow::Result<Self> {
        
        let readings: Vec<SensorReading> = config
            .sensors
            .iter()
            .map(|sensor_def| SensorReading {
                uart_index: sensor_def.uart_index,
                position: sensor_def.position,
                distance_cm: 999, 
                last_update: std::time::Instant::now(),
            })
            .collect();

        let sensor_count = readings.len();
        let readings = Arc::new(RwLock::new(readings));

        
        if !config.port.is_empty() {
            match tokio_serial::new(&config.port, config.baud_rate)
                .timeout(Duration::from_millis(100))
                .open_native_async()
            {
                Ok(port) => {
                    tracing::info!(
                        "Parking sensors UART initialized: {} @ {} baud, {} sensors",
                        config.port,
                        config.baud_rate,
                        sensor_count
                    );

                    
                    for sensor in &config.sensors {
                        tracing::info!(
                            "  Sensor uart_index={} -> position={}",
                            sensor.uart_index,
                            sensor.position.as_str()
                        );
                    }

                    
                    let readings_clone = readings.clone();
                    let poll_interval = config.poll_interval_ms;
                    tokio::spawn(async move {
                        run_uart_reader(port, readings_clone, poll_interval).await;
                    });
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to open parking sensor UART at {}: {} - parking data will be static",
                        config.port,
                        e
                    );
                }
            };
        } else {
            tracing::info!("Parking UART port not configured, sensors disabled");
        }

        Ok(Self {
            sensors: config.sensors.clone(),
            readings,
        })
    }

    
    pub async fn read_state(&self) -> ParkingState {
        let readings = self.readings.read();
        ParkingState {
            sensors: readings
                .iter()
                .map(|r| ParkingSensor {
                    position: r.position,
                    distance_cm: r.distance_cm,
                })
                .collect(),
        }
    }

    
    #[allow(dead_code)]
    pub fn sensor_count(&self) -> usize {
        self.sensors.len()
    }

    
    #[allow(dead_code)]
    pub fn sensor_positions(&self) -> Vec<SensorPosition> {
        self.sensors.iter().map(|s| s.position).collect()
    }
}



async fn run_uart_reader(
    mut port: tokio_serial::SerialStream,
    readings: Arc<RwLock<Vec<SensorReading>>>,
    poll_interval_ms: u64,
) {
    tracing::info!("Parking sensor UART reader started");

    let mut buffer = [0u8; 256];
    let mut parse_buffer = Vec::with_capacity(64);
    let mut current_uart_index: u8 = 0;

    
    let sensor_count = readings.read().len() as u8;
    if sensor_count == 0 {
        tracing::warn!("No sensors configured, UART reader exiting");
        return;
    }

    loop {
        
        tokio::time::sleep(Duration::from_millis(poll_interval_ms.max(10))).await;

        
        match port.try_read(&mut buffer) {
            Ok(0) => continue,
            Ok(n) => {
                parse_buffer.extend_from_slice(&buffer[..n]);
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                continue;
            }
            Err(e) => {
                tracing::error!("Parking UART read error: {}", e);
                tokio::time::sleep(Duration::from_millis(100)).await;
                continue;
            }
        }

        
        
        while parse_buffer.len() >= 4 {
            
            let sync_pos = parse_buffer.iter().position(|&b| b == 0xFF);

            match sync_pos {
                Some(0) => {
                    
                    if parse_buffer.len() >= 4 {
                        let high = parse_buffer[1];
                        let low = parse_buffer[2];
                        let checksum = parse_buffer[3];

                        
                        let expected_checksum = high.wrapping_add(low);
                        if checksum == expected_checksum {
                            let distance_mm = ((high as u16) << 8) | (low as u16);
                            let distance_cm = (distance_mm / 10) as u32;

                            
                            
                            let mut readings = readings.write();
                            if let Some(reading) = readings
                                .iter_mut()
                                .find(|r| r.uart_index == current_uart_index)
                            {
                                reading.distance_cm = if distance_cm < 2 || distance_cm > 450 {
                                    999 
                                } else {
                                    distance_cm
                                };
                                reading.last_update = std::time::Instant::now();

                                tracing::trace!(
                                    "Parking sensor {} ({}): {} cm",
                                    current_uart_index,
                                    reading.position.as_str(),
                                    reading.distance_cm
                                );
                            }

                            
                            current_uart_index = (current_uart_index + 1) % sensor_count;
                        } else {
                            tracing::warn!(
                                "Parking checksum mismatch: expected {:02X}, got {:02X}",
                                expected_checksum,
                                checksum
                            );
                        }

                        
                        parse_buffer.drain(..4);
                    } else {
                        break; 
                    }
                }
                Some(pos) => {
                    
                    parse_buffer.drain(..pos);
                }
                None => {
                    
                    parse_buffer.clear();
                }
            }
        }

        
        if parse_buffer.len() > 128 {
            parse_buffer.drain(..64);
        }
    }
}
