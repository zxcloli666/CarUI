






use carui_common::SensorPosition;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub listen_addr: String,

    
    #[serde(default = "default_gpio_chip")]
    pub gpio_chip: String,

    pub doors: DoorPins,
    pub reverse: ReversePins,
    pub parking: ParkingConfig,
}

fn default_gpio_chip() -> String {
    "gpiochip0".to_string()
}

#[derive(Clone, Debug, Deserialize)]
pub struct DoorPins {
    pub front_left: u32,
    pub front_right: u32,
    pub rear_left: u32,
    pub rear_right: u32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ReversePins {
    pub signal: u32,
}


#[derive(Clone, Debug, Deserialize)]
pub struct SensorDef {
    
    pub position: SensorPosition,

    
    
    pub uart_index: u8,

    
    #[serde(default)]
    pub trigger_pin: Option<u32>,

    
    #[serde(default)]
    pub echo_pin: Option<u32>,
}





#[derive(Clone, Debug, Deserialize)]
pub struct ParkingConfig {
    
    
    #[serde(default)]
    pub port: String,

    
    #[serde(default = "default_baud_rate")]
    pub baud_rate: u32,

    
    
    #[serde(default)]
    pub sensors: Vec<SensorDef>,

    
    #[serde(default = "default_poll_interval")]
    pub poll_interval_ms: u64,
}

fn default_baud_rate() -> u32 {
    9600
}

fn default_poll_interval() -> u64 {
    100
}

impl Default for Config {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:8084".to_string(),
            gpio_chip: default_gpio_chip(),
            doors: DoorPins {
                front_left: 17,
                front_right: 27,
                rear_left: 22,
                rear_right: 23,
            },
            reverse: ReversePins { signal: 24 },
            parking: ParkingConfig {
                port: "/dev/ttyUSB0".to_string(),
                baud_rate: 9600,
                sensors: vec![
                    SensorDef {
                        position: SensorPosition::RearLeft,
                        uart_index: 0,
                        trigger_pin: None,
                        echo_pin: None,
                    },
                    SensorDef {
                        position: SensorPosition::RearCenterLeft,
                        uart_index: 1,
                        trigger_pin: None,
                        echo_pin: None,
                    },
                    SensorDef {
                        position: SensorPosition::RearCenterRight,
                        uart_index: 2,
                        trigger_pin: None,
                        echo_pin: None,
                    },
                    SensorDef {
                        position: SensorPosition::RearRight,
                        uart_index: 3,
                        trigger_pin: None,
                        echo_pin: None,
                    },
                ],
                poll_interval_ms: 100,
            },
        }
    }
}
