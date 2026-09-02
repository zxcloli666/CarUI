

use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub listen_addr: String,
    pub services: ServiceEndpoints,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ServiceEndpoints {
    pub gpio: String,
    pub speed: String,
    pub cameras: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:8080".to_string(),
            services: ServiceEndpoints {
                speed: "http://localhost:8082".to_string(),
                cameras: "http://localhost:8083".to_string(),
                gpio: "http://localhost:8084".to_string(),
            },
        }
    }
}
