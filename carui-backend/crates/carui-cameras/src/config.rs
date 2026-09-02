use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    #[serde(default = "default_listen_addr")]
    pub listen_addr: String,

    #[serde(default = "default_recordings_path")]
    pub recordings_path: PathBuf,

    #[serde(default = "default_max_storage_gb")]
    pub max_storage_gb: u64,

    #[serde(default)]
    pub auto_record: bool,

    #[serde(default)]
    pub cameras: Vec<CameraConfig>,
    
    #[serde(default = "default_width")]
    pub output_width: u32,
    #[serde(default = "default_height")]
    pub output_height: u32,
    #[serde(default = "default_fps")]
    pub output_fps: u32,

    
    #[serde(default = "default_segment_duration")]
    pub segment_duration_secs: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CameraConfig {
    pub id: String,         
    pub device: String,     
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_fps")]
    pub fps: u32,

    
    #[serde(default)]
    pub grid_index: usize,
}

fn default_listen_addr() -> String { "0.0.0.0:8083".to_string() }
fn default_recordings_path() -> PathBuf { PathBuf::from("/var/lib/carui/recordings") }
fn default_max_storage_gb() -> u64 { 32 }
fn default_width() -> u32 { 1280 }
fn default_height() -> u32 { 720 }
fn default_fps() -> u32 { 30 }
fn default_segment_duration() -> u64 { 7200 }