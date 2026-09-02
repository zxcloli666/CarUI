

use carui_common::SensorPosition;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub listen_addr: String,
    #[serde(default)]
    pub video_path: Option<String>,
    
    #[serde(default)]
    pub v4l2_devices: Vec<V4l2DeviceConfig>,
    
    #[serde(default)]
    pub gpio: GpioConfig,
    
    #[serde(default)]
    pub parking: ParkingConfig,
}


#[derive(Clone, Debug, Deserialize)]
pub struct SensorDef {
    
    pub position: SensorPosition,
    
    pub uart_index: u8,
}


#[derive(Clone, Debug, Default, Deserialize)]
pub struct ParkingConfig {
    
    #[serde(default)]
    pub sensors: Vec<SensorDef>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct GpioConfig {
    
    pub chip: Option<String>,
    
    #[serde(default = "default_door_pins")]
    pub door_pins: [u32; 4],
    
    #[serde(default = "default_reverse_pin")]
    pub reverse_pin: u32,
}

impl Default for GpioConfig {
    fn default() -> Self {
        Self {
            chip: None,
            door_pins: default_door_pins(),
            reverse_pin: default_reverse_pin(),
        }
    }
}

fn default_door_pins() -> [u32; 4] {
    [17, 27, 22, 23]
}

fn default_reverse_pin() -> u32 {
    24
}

#[derive(Clone, Debug, Deserialize)]
pub struct V4l2DeviceConfig {
    pub camera_id: String,
    pub device: String, 
}

impl Default for Config {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:9090".to_string(),
            video_path: None,
            v4l2_devices: vec![
                V4l2DeviceConfig { camera_id: "front".to_string(), device: "/dev/video10".to_string() },
                V4l2DeviceConfig { camera_id: "rear".to_string(), device: "/dev/video11".to_string() },
                V4l2DeviceConfig { camera_id: "left".to_string(), device: "/dev/video12".to_string() },
                V4l2DeviceConfig { camera_id: "right".to_string(), device: "/dev/video13".to_string() },
            ],
            gpio: GpioConfig::default(),
            parking: ParkingConfig::default(),
        }
    }
}
