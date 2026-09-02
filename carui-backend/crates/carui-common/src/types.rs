

use serde::{Deserialize, Serialize};






#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GpsPosition {
    pub lat: f64,
    pub lon: f64,
    pub bearing: f32,
    pub speed_ms: f32,
    pub timestamp: u64,
    pub source: GpsSource,
}


#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GpsSource {
    #[default]
    None,
    UBlox,
    Client,
}

impl GpsSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            GpsSource::None => "none",
            GpsSource::UBlox => "ublox",
            GpsSource::Client => "client",
        }
    }
}


#[derive(Clone, Debug, Deserialize)]
pub struct ClientGpsData {
    pub lat: f64,
    pub lon: f64,
    pub bearing: f32,
    pub speed_kmh: f32,
}






#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct DoorState {
    pub front_left: bool,
    pub front_right: bool,
    pub rear_left: bool,
    pub rear_right: bool,
}

impl DoorState {
    
    pub fn any_open(&self) -> bool {
        self.front_left || self.front_right || self.rear_left || self.rear_right
    }

    
    pub fn open_doors(&self) -> Vec<&'static str> {
        let mut doors = Vec::new();
        if self.front_left {
            doors.push("front_left");
        }
        if self.front_right {
            doors.push("front_right");
        }
        if self.rear_left {
            doors.push("rear_left");
        }
        if self.rear_right {
            doors.push("rear_right");
        }
        doors
    }
}






#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SensorPosition {
    
    
    RearLeft,
    
    RearCenterLeft,
    
    RearCenterRight,
    
    RearRight,

    
    
    FrontLeft,
    
    FrontCenterLeft,
    
    FrontCenterRight,
    
    FrontRight,

    
    
    LeftFront,
    
    LeftRear,
    
    RightFront,
    
    RightRear,
}

impl SensorPosition {
    pub fn as_str(&self) -> &'static str {
        match self {
            SensorPosition::RearLeft => "rear_left",
            SensorPosition::RearCenterLeft => "rear_center_left",
            SensorPosition::RearCenterRight => "rear_center_right",
            SensorPosition::RearRight => "rear_right",
            SensorPosition::FrontLeft => "front_left",
            SensorPosition::FrontCenterLeft => "front_center_left",
            SensorPosition::FrontCenterRight => "front_center_right",
            SensorPosition::FrontRight => "front_right",
            SensorPosition::LeftFront => "left_front",
            SensorPosition::LeftRear => "left_rear",
            SensorPosition::RightFront => "right_front",
            SensorPosition::RightRear => "right_rear",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "rear_left" => Some(SensorPosition::RearLeft),
            "rear_center_left" => Some(SensorPosition::RearCenterLeft),
            "rear_center_right" => Some(SensorPosition::RearCenterRight),
            "rear_right" => Some(SensorPosition::RearRight),
            "front_left" => Some(SensorPosition::FrontLeft),
            "front_center_left" => Some(SensorPosition::FrontCenterLeft),
            "front_center_right" => Some(SensorPosition::FrontCenterRight),
            "front_right" => Some(SensorPosition::FrontRight),
            "left_front" => Some(SensorPosition::LeftFront),
            "left_rear" => Some(SensorPosition::LeftRear),
            "right_front" => Some(SensorPosition::RightFront),
            "right_rear" => Some(SensorPosition::RightRear),
            _ => None,
        }
    }

    
    pub fn is_rear(&self) -> bool {
        matches!(
            self,
            SensorPosition::RearLeft
                | SensorPosition::RearCenterLeft
                | SensorPosition::RearCenterRight
                | SensorPosition::RearRight
        )
    }

    
    pub fn is_front(&self) -> bool {
        matches!(
            self,
            SensorPosition::FrontLeft
                | SensorPosition::FrontCenterLeft
                | SensorPosition::FrontCenterRight
                | SensorPosition::FrontRight
        )
    }

    
    pub fn is_side(&self) -> bool {
        matches!(
            self,
            SensorPosition::LeftFront
                | SensorPosition::LeftRear
                | SensorPosition::RightFront
                | SensorPosition::RightRear
        )
    }

    
    pub fn is_left(&self) -> bool {
        matches!(
            self,
            SensorPosition::RearLeft
                | SensorPosition::FrontLeft
                | SensorPosition::LeftFront
                | SensorPosition::LeftRear
        )
    }

    
    pub fn is_right(&self) -> bool {
        matches!(
            self,
            SensorPosition::RearRight
                | SensorPosition::FrontRight
                | SensorPosition::RightFront
                | SensorPosition::RightRear
        )
    }

    
    pub fn display_order(&self) -> u8 {
        match self {
            
            SensorPosition::RearLeft | SensorPosition::FrontLeft => 0,
            SensorPosition::RearCenterLeft | SensorPosition::FrontCenterLeft => 1,
            SensorPosition::RearCenterRight | SensorPosition::FrontCenterRight => 2,
            SensorPosition::RearRight | SensorPosition::FrontRight => 3,
            
            SensorPosition::LeftFront | SensorPosition::RightFront => 0,
            SensorPosition::LeftRear | SensorPosition::RightRear => 1,
        }
    }
}


#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParkingSensor {
    
    pub position: SensorPosition,
    
    pub distance_cm: u32,
}


#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ParkingState {
    pub sensors: Vec<ParkingSensor>,
}

impl ParkingState {
    
    pub fn min_rear_distance(&self) -> Option<u32> {
        self.sensors
            .iter()
            .filter(|s| s.position.is_rear() && s.distance_cm < 999)
            .map(|s| s.distance_cm)
            .min()
    }

    
    pub fn min_front_distance(&self) -> Option<u32> {
        self.sensors
            .iter()
            .filter(|s| s.position.is_front() && s.distance_cm < 999)
            .map(|s| s.distance_cm)
            .min()
    }

    
    pub fn min_left_distance(&self) -> Option<u32> {
        self.sensors
            .iter()
            .filter(|s| s.position.is_left() && s.position.is_side() && s.distance_cm < 999)
            .map(|s| s.distance_cm)
            .min()
    }

    
    pub fn min_right_distance(&self) -> Option<u32> {
        self.sensors
            .iter()
            .filter(|s| s.position.is_right() && s.position.is_side() && s.distance_cm < 999)
            .map(|s| s.distance_cm)
            .min()
    }
}






#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpeedInfo {
    pub limit: i32,
    pub gps_source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_change: Option<SpeedChange>,
}


#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpeedChange {
    pub distance_m: i32,
    pub current_limit: i32,
    pub new_limit: i32,
}






#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RadarAlert {
    pub source: RadarSource,
    pub distance_m: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed_limit: Option<i32>,
    pub direction: AlertDirection,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RadarSource {
    Camera,
    RadarK,
    RadarKa,
    Laser,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertDirection {
    #[default]
    Ahead,
    Behind,
}






#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CameraId {
    Front,
    Rear,
    Left,
    Right,
}

impl CameraId {
    pub fn as_str(&self) -> &'static str {
        match self {
            CameraId::Front => "front",
            CameraId::Rear => "rear",
            CameraId::Left => "left",
            CameraId::Right => "right",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "front" => Some(CameraId::Front),
            "rear" => Some(CameraId::Rear),
            "left" => Some(CameraId::Left),
            "right" => Some(CameraId::Right),
            _ => None,
        }
    }
}


#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Recording {
    pub id: String,
    pub filename: String,
    pub size_bytes: u64,
    pub duration_sec: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}






#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WsEvent {
    pub topic: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: serde_json::Value,
}

impl WsEvent {
    pub fn new(topic: &str, event_type: &str, data: impl Serialize) -> Self {
        Self {
            topic: topic.to_string(),
            event_type: event_type.to_string(),
            data: serde_json::to_value(data).unwrap_or_default(),
        }
    }
}






#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub service: String,
    pub status: String,
    pub version: String,
}

impl HealthResponse {
    pub fn ok(service: &str) -> Self {
        Self {
            service: service.to_string(),
            status: "ok".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}
