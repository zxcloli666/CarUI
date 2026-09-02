

use serde::de::DeserializeOwned;
use std::path::Path;







pub fn load_config<T: DeserializeOwned>(service_name: &str) -> anyhow::Result<T> {
    let path = std::env::var("CONFIG_PATH").unwrap_or_else(|_| {
        let local = format!("./config/{}.toml", service_name);
        if Path::new(&local).exists() {
            local
        } else {
            format!("/etc/carui/{}.toml", service_name)
        }
    });

    tracing::info!("Loading config from: {}", path);

    let content = std::fs::read_to_string(&path)
        .map_err(|e| anyhow::anyhow!("Failed to read config file '{}': {}", path, e))?;

    let config: T = toml::from_str(&content)
        .map_err(|e| anyhow::anyhow!("Failed to parse config file '{}': {}", path, e))?;

    Ok(config)
}


pub fn init_tracing() {
    use tracing_subscriber::{fmt, prelude::*, EnvFilter};

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();
}
