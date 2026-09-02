












use std::io::Write;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::PathBuf;

use nix::pty::{openpty, OpenptyResult};
use nix::unistd;
use parking_lot::RwLock;
use tokio::sync::broadcast;

use carui_common::{ParkingSensor, ParkingState, SensorPosition, WsEvent};


#[derive(Clone, Debug)]
pub struct MockSensorDef {
    
    pub position: SensorPosition,
    
    pub uart_index: u8,
}


#[derive(Clone, Debug)]
pub struct ParkingSensorData {
    
    pub position: SensorPosition,
    
    pub uart_index: u8,
    
    pub distance_cm: u32,
}


struct PtyPair {
    master: OwnedFd,
    slave_path: PathBuf,
}

pub struct MockParking {
    sensors: RwLock<Vec<ParkingSensorData>>,
    event_tx: broadcast::Sender<WsEvent>,
    pty: Option<PtyPair>,
    pty_path: RwLock<Option<PathBuf>>,
}

impl MockParking {
    
    pub fn with_sensors(sensor_defs: Vec<MockSensorDef>) -> Self {
        let (event_tx, _) = broadcast::channel(256);

        
        let sensors: Vec<ParkingSensorData> = sensor_defs
            .iter()
            .map(|def| ParkingSensorData {
                position: def.position,
                uart_index: def.uart_index,
                distance_cm: 400, 
            })
            .collect();

        
        let pty = match create_parking_pty() {
            Ok(p) => {
                tracing::info!("Parking UART PTY created at: {:?}", p.slave_path);
                Some(p)
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to create Parking PTY: {} - UART output disabled",
                    e
                );
                None
            }
        };

        let pty_path = RwLock::new(pty.as_ref().map(|p| p.slave_path.clone()));

        Self {
            sensors: RwLock::new(sensors),
            event_tx,
            pty,
            pty_path,
        }
    }

    
    pub fn new(sensor_count: usize) -> Self {
        
        let default_positions = [
            SensorPosition::RearLeft,
            SensorPosition::RearCenterLeft,
            SensorPosition::RearCenterRight,
            SensorPosition::RearRight,
        ];

        let sensor_defs: Vec<MockSensorDef> = (0..sensor_count.min(default_positions.len()))
            .map(|i| MockSensorDef {
                position: default_positions[i],
                uart_index: i as u8,
            })
            .collect();

        Self::with_sensors(sensor_defs)
    }

    
    pub fn get_pty_path(&self) -> Option<PathBuf> {
        self.pty_path.read().clone()
    }

    pub fn get_state(&self) -> ParkingState {
        let sensors = self.sensors.read();
        ParkingState {
            sensors: sensors
                .iter()
                .map(|s| ParkingSensor {
                    position: s.position,
                    distance_cm: s.distance_cm,
                })
                .collect(),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    
    pub fn set_sensor_by_position(&self, position: SensorPosition, distance_cm: u32) {
        let mut sensors = self.sensors.write();
        if let Some(sensor) = sensors.iter_mut().find(|s| s.position == position) {
            sensor.distance_cm = distance_cm.clamp(2, 450);
        }
    }

    
    pub fn set_sensor_by_index(&self, uart_index: u8, distance_cm: u32) {
        let mut sensors = self.sensors.write();
        if let Some(sensor) = sensors.iter_mut().find(|s| s.uart_index == uart_index) {
            sensor.distance_cm = distance_cm.clamp(2, 450);
        }
    }

    
    pub fn set_all_sensors(&self, distances: Vec<u32>) {
        let mut sensors = self.sensors.write();
        
        sensors.sort_by_key(|s| s.uart_index);

        for (i, &dist) in distances.iter().enumerate() {
            if let Some(sensor) = sensors.get_mut(i) {
                sensor.distance_cm = dist.clamp(2, 450);
            }
        }
        drop(sensors);

        
        let state = self.get_state();
        let event = WsEvent::new("gpio", "parking", &state);
        let _ = self.event_tx.send(event);

        tracing::debug!("Parking sensors updated: {:?}", distances);
    }

    
    
    fn write_uart_data(&self) {
        if let Some(ref pty) = self.pty {
            let mut sensors = self.sensors.read().clone();
            
            sensors.sort_by_key(|s| s.uart_index);

            
            
            let mut data = Vec::with_capacity(sensors.len() * 4);

            for sensor in sensors.iter() {
                let distance_mm = (sensor.distance_cm * 10) as u16;
                let high_byte = (distance_mm >> 8) as u8;
                let low_byte = (distance_mm & 0xFF) as u8;
                let checksum = high_byte.wrapping_add(low_byte);

                data.push(0xFF); 
                data.push(high_byte);
                data.push(low_byte);
                data.push(checksum);
            }

            
            let mut master_file =
                unsafe { std::fs::File::from_raw_fd(pty.master.as_raw_fd()) };

            let _ = master_file.write_all(&data);
            let _ = master_file.flush();

            
            std::mem::forget(master_file);
        }
    }

    
    pub async fn run_output_loop(&self) {
        
        
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            self.write_uart_data();
        }
    }
}

impl Default for MockParking {
    fn default() -> Self {
        Self::new(4)
    }
}


fn create_parking_pty() -> anyhow::Result<PtyPair> {
    let OpenptyResult { master, slave } = openpty(None, None)?;

    
    let slave_path = unistd::ttyname(&slave)?;

    
    let symlink_path = PathBuf::from("/tmp/mock-parking");
    let _ = std::fs::remove_file(&symlink_path); 
    std::os::unix::fs::symlink(&slave_path, &symlink_path)?;

    tracing::info!(
        "Parking PTY: {} -> {}",
        symlink_path.display(),
        slave_path.display()
    );

    Ok(PtyPair {
        master,
        slave_path: symlink_path,
    })
}