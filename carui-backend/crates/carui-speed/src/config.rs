

use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub listen_addr: String,
    pub db_path: String,
    pub gps_port: String,
    #[serde(default = "default_tile_ttl")]
    pub tile_ttl_days: u32,
    #[serde(default = "default_overpass_url")]
    pub overpass_url: String,
}

fn default_tile_ttl() -> u32 {
    
    7 
}

fn default_overpass_url() -> String {
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:8082".to_string(),
            db_path: "/var/lib/carui/speed.db".to_string(),
            gps_port: "/dev/ttyAMA0".to_string(),
            tile_ttl_days: default_tile_ttl(),
            overpass_url: default_overpass_url(),
        }
    }
}