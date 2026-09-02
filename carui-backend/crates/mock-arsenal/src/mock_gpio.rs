










use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use parking_lot::RwLock;
use tokio::sync::broadcast;

use carui_common::{DoorState, ParkingSensor, ParkingState, SensorPosition, WsEvent};

#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct MockGpioState {
    pub doors: DoorState,
    pub reverse: bool,
    pub parking: ParkingState,
}

pub struct MockGpio {
    state: RwLock<MockGpioState>,
    event_tx: broadcast::Sender<WsEvent>,
    gpio_chip: Option<String>,
    door_pins: [u32; 4],
    reverse_pin: u32,
    gpio_values: RwLock<[bool; 5]>,  
}

impl MockGpio {
    pub fn new() -> Self {
        Self::with_config(None, [17, 27, 22, 23], 24)
    }

    pub fn with_config(gpio_chip: Option<String>, door_pins: [u32; 4], reverse_pin: u32) -> Self {
        let (event_tx, _) = broadcast::channel(256);

        
        let default_positions = [
            SensorPosition::RearLeft,
            SensorPosition::RearCenterLeft,
            SensorPosition::RearCenterRight,
            SensorPosition::RearRight,
        ];

        let mut state = MockGpioState::default();
        state.parking = ParkingState {
            sensors: default_positions
                .iter()
                .map(|&pos| ParkingSensor {
                    position: pos,
                    distance_cm: 400,
                })
                .collect(),
        };

        
        if let Some(ref chip) = gpio_chip {
            tracing::info!("GPIO emulation enabled: {} pins {:?}", chip, [door_pins[0], door_pins[1], door_pins[2], door_pins[3], reverse_pin]);
        } else {
            tracing::warn!("GPIO emulation disabled - chip not configured");
        }

        Self {
            state: RwLock::new(state),
            event_tx,
            gpio_chip,
            door_pins,
            reverse_pin,
            gpio_values: RwLock::new([true, true, true, true, false]),  
        }
    }

    
    
    fn find_gpio_value_path(&self, chip_name: &str, line: u32) -> Option<PathBuf> {
        
        
        

        if let Ok(entries) = fs::read_dir("/sys/devices/platform") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("gpio-sim") {
                    let platform_path = entry.path();

                    
                    let chip_path = platform_path.join(chip_name);
                    if chip_path.exists() {
                        
                        
                        let sim_gpio_path = chip_path.join(format!("sim_gpio{}", line)).join("pull");
                        if sim_gpio_path.exists() {
                            return Some(sim_gpio_path);
                        }
                    }
                }
            }
        }

        
        if let Ok(entries) = fs::read_dir("/sys/devices/platform") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("gpio-sim") {
                    
                    if let Ok(sub_entries) = fs::read_dir(entry.path()) {
                        for sub in sub_entries.flatten() {
                            let sub_name = sub.file_name();
                            if sub_name.to_string_lossy().starts_with("gpiochip") {
                                let sim_gpio_path = sub.path().join(format!("sim_gpio{}", line)).join("pull");
                                if sim_gpio_path.exists() {
                                    return Some(sim_gpio_path);
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }

    fn write_gpio(&self, pin: u32, value: bool) {
        let Some(ref chip_name) = self.gpio_chip else {
            return;
        };

        
        let all_pins = [self.door_pins[0], self.door_pins[1], self.door_pins[2], self.door_pins[3], self.reverse_pin];
        if let Some(idx) = all_pins.iter().position(|&p| p == pin) {
            {
                let mut values = self.gpio_values.write();
                values[idx] = value;
            }

            
            
            if let Some(path) = self.find_gpio_value_path(chip_name, pin) {
                let pull_value = if value { b"pull-up" as &[u8] } else { b"pull-down" };
                let result = OpenOptions::new()
                    .write(true)
                    .open(&path)
                    .and_then(|mut f| f.write_all(pull_value));

                match result {
                    Ok(_) => tracing::debug!("GPIO {} pin {} = {} (via {})", chip_name, pin, value, path.display()),
                    Err(e) => tracing::error!("GPIO write FAILED {} pin {}: {} (path: {})", chip_name, pin, e, path.display()),
                }
            } else {
                tracing::warn!("GPIO sysfs path not found for {} line {} - run scripts/setup-dev-gpio.sh", chip_name, pin);
            }
        }
    }

    pub fn get_state(&self) -> MockGpioState {
        self.state.read().clone()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.event_tx.subscribe()
    }

    pub fn set_doors(&self, doors: DoorState) {
        {
            let mut state = self.state.write();
            state.doors = doors.clone();
        }

        
        self.write_gpio(self.door_pins[0], !doors.front_left);
        self.write_gpio(self.door_pins[1], !doors.front_right);
        self.write_gpio(self.door_pins[2], !doors.rear_left);
        self.write_gpio(self.door_pins[3], !doors.rear_right);

        let event = WsEvent::new("gpio", "doors", &doors);
        let _ = self.event_tx.send(event);

        tracing::info!("Doors: {:?}", doors);
    }

    pub fn set_reverse(&self, active: bool) {
        {
            let mut state = self.state.write();
            state.reverse = active;
        }

        self.write_gpio(self.reverse_pin, active);

        let event = WsEvent::new("gpio", "reverse", &active);
        let _ = self.event_tx.send(event);

        tracing::info!("Reverse: {}", active);
    }

    
    
    pub fn set_parking(&self, distances: Vec<u32>) {
        let all_positions = [
            SensorPosition::RearLeft,
            SensorPosition::RearCenterLeft,
            SensorPosition::RearCenterRight,
            SensorPosition::RearRight,
            SensorPosition::FrontLeft,
            SensorPosition::FrontCenterLeft,
            SensorPosition::FrontCenterRight,
            SensorPosition::FrontRight,
            SensorPosition::LeftFront,
            SensorPosition::LeftRear,
            SensorPosition::RightFront,
            SensorPosition::RightRear,
        ];

        let parking = ParkingState {
            sensors: distances
                .into_iter()
                .enumerate()
                .filter_map(|(i, d)| {
                    all_positions.get(i).map(|&pos| ParkingSensor {
                        position: pos,
                        distance_cm: d,
                    })
                })
                .collect(),
        };

        {
            let mut state = self.state.write();
            state.parking = parking.clone();
        }

        let event = WsEvent::new("gpio", "parking", &parking);
        let _ = self.event_tx.send(event);

        tracing::info!("Parking updated");
    }

    pub fn toggle_door(&self, door: &str) {
        let mut state = self.state.write();
        match door {
            "front_left" => state.doors.front_left = !state.doors.front_left,
            "front_right" => state.doors.front_right = !state.doors.front_right,
            "rear_left" => state.doors.rear_left = !state.doors.rear_left,
            "rear_right" => state.doors.rear_right = !state.doors.rear_right,
            _ => return,
        }

        let doors = state.doors.clone();
        drop(state);

        let event = WsEvent::new("gpio", "doors", &doors);
        let _ = self.event_tx.send(event);
    }
}

impl Default for MockGpio {
    fn default() -> Self {
        Self::new()
    }
}