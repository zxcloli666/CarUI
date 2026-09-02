




use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};


#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CameraSource {
    #[default]
    TestPattern,
    VideoFile(String),
}


#[derive(Clone, Debug, Serialize)]
pub struct CameraState {
    pub id: String,
    pub source: CameraSource,
    pub device: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub active: bool,
}


#[derive(Clone)]
pub struct CameraConfig {
    pub id: String,
    pub device: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}


pub struct MockCameras {
    cameras: HashMap<String, Arc<RwLock<CameraState>>>,
    
    on_source_change: RwLock<Option<Box<dyn Fn(&str, &CameraSource) + Send + Sync>>>,
}

impl MockCameras {
    pub fn new(configs: &[CameraConfig], default_video: Option<&str>) -> Self {
        let mut cameras = HashMap::new();

        for config in configs {
            let source = match default_video {
                Some(path) => CameraSource::VideoFile(path.to_string()),
                None => CameraSource::TestPattern,
            };

            let state = CameraState {
                id: config.id.clone(),
                source,
                device: config.device.clone(),
                width: config.width,
                height: config.height,
                fps: config.fps,
                active: false,
            };

            cameras.insert(config.id.clone(), Arc::new(RwLock::new(state)));
        }

        Self {
            cameras,
            on_source_change: RwLock::new(None),
        }
    }

    
    pub fn set_on_source_change<F>(&self, callback: F)
    where
        F: Fn(&str, &CameraSource) + Send + Sync + 'static,
    {
        *self.on_source_change.write() = Some(Box::new(callback));
    }

    
    pub fn get(&self, id: &str) -> Option<CameraState> {
        self.cameras.get(id).map(|c| c.read().clone())
    }

    
    pub fn list(&self) -> Vec<String> {
        self.cameras.keys().cloned().collect()
    }

    
    pub fn get_all(&self) -> Vec<CameraState> {
        self.cameras.values().map(|c| c.read().clone()).collect()
    }

    
    pub fn set_source(&self, camera_id: &str, source: CameraSource) -> bool {
        if let Some(camera) = self.cameras.get(camera_id) {
            let mut state = camera.write();
            if state.source != source {
                state.source = source.clone();
                drop(state);

                
                if let Some(ref callback) = *self.on_source_change.read() {
                    callback(camera_id, &source);
                }

                tracing::info!("Camera {} source changed: {:?}", camera_id, source);
            }
            true
        } else {
            false
        }
    }

    
    pub fn set_all_source(&self, source: CameraSource) {
        for id in self.cameras.keys() {
            self.set_source(id, source.clone());
        }
    }

    
    pub fn set_active(&self, camera_id: &str, active: bool) {
        if let Some(camera) = self.cameras.get(camera_id) {
            camera.write().active = active;
        }
    }

    
    pub fn get_device(&self, camera_id: &str) -> Option<String> {
        self.cameras.get(camera_id).map(|c| c.read().device.clone())
    }

    
    pub fn get_source(&self, camera_id: &str) -> Option<CameraSource> {
        self.cameras.get(camera_id).map(|c| c.read().source.clone())
    }
}