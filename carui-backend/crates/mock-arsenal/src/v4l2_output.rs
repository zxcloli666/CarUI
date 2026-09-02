









use std::collections::HashMap;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use parking_lot::RwLock;

use crate::config::V4l2DeviceConfig;
use crate::mock_cameras::CameraSource;


pub struct V4l2Stream {
    camera_id: String,
    device_path: String,
    width: u32,
    height: u32,
    fps: u32,
    ffmpeg: RwLock<Option<Child>>,
    current_source: RwLock<Option<CameraSource>>,
}

impl V4l2Stream {
    pub fn new(camera_id: &str, device_path: &str, width: u32, height: u32, fps: u32) -> Self {
        Self {
            camera_id: camera_id.to_string(),
            device_path: device_path.to_string(),
            width,
            height,
            fps,
            ffmpeg: RwLock::new(None),
            current_source: RwLock::new(None),
        }
    }

    
    pub fn is_available(&self) -> bool {
        Path::new(&self.device_path).exists()
    }

    
    pub fn start(&self, source: &CameraSource) -> anyhow::Result<()> {
        
        self.stop();

        if !self.is_available() {
            anyhow::bail!(
                "V4L2 device {} not available. Run: sudo modprobe v4l2loopback devices=4 video_nr=10,11,12,13 exclusive_caps=0",
                self.device_path
            );
        }

        let child = match source {
            CameraSource::TestPattern => self.start_test_pattern()?,
            CameraSource::VideoFile(path) => self.start_video_file(path)?,
        };

        *self.ffmpeg.write() = Some(child);
        *self.current_source.write() = Some(source.clone());

        tracing::info!(
            "V4L2 stream started: {} -> {} ({:?})",
            self.camera_id,
            self.device_path,
            source
        );

        Ok(())
    }

    
    fn start_test_pattern(&self) -> anyhow::Result<Child> {
        
        
        let filter = format!(
            "testsrc=size={}x{}:rate={},drawtext=text='%{{localtime}}':fontsize=32:fontcolor=white:x=10:y=10",
            self.width, self.height, self.fps
        );

        let child = Command::new("ffmpeg")
            .args([
                "-re",                          
                "-f", "lavfi",
                "-i", &filter,
                "-f", "v4l2",
                "-pix_fmt", "yuyv422",
                &self.device_path,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;

        Ok(child)
    }

    
    fn start_video_file(&self, video_path: &str) -> anyhow::Result<Child> {
        if !Path::new(video_path).exists() {
            anyhow::bail!("Video file not found: {}", video_path);
        }

        
        let child = Command::new("ffmpeg")
            .args([
                "-stream_loop", "-1",           
                "-re",                          
                "-i", video_path,
                "-vf", &format!("scale={}:{}", self.width, self.height),
                "-r", &self.fps.to_string(),
                "-f", "v4l2",
                "-pix_fmt", "yuyv422",
                &self.device_path,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;

        Ok(child)
    }

    
    pub fn stop(&self) {
        if let Some(mut child) = self.ffmpeg.write().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *self.current_source.write() = None;
    }

    
    pub fn is_running(&self) -> bool {
        let mut guard = self.ffmpeg.write();
        if let Some(ref mut child) = *guard {
            
            match child.try_wait() {
                Ok(None) => true,  
                Ok(Some(_)) => {
                    
                    *guard = None;
                    false
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }

    
    pub fn get_source(&self) -> Option<CameraSource> {
        self.current_source.read().clone()
    }

    
    pub fn set_source(&self, source: &CameraSource) -> anyhow::Result<()> {
        let current = self.current_source.read().clone();

        
        if current.as_ref() != Some(source) {
            self.start(source)?;
        }

        Ok(())
    }
}

impl Drop for V4l2Stream {
    fn drop(&mut self) {
        self.stop();
    }
}


pub struct V4l2StreamManager {
    streams: HashMap<String, Arc<V4l2Stream>>,
}

impl V4l2StreamManager {
    pub fn new(configs: &[V4l2DeviceConfig], width: u32, height: u32, fps: u32) -> Self {
        let mut streams = HashMap::new();

        for config in configs {
            let stream = Arc::new(V4l2Stream::new(
                &config.camera_id,
                &config.device,
                width,
                height,
                fps,
            ));
            streams.insert(config.camera_id.clone(), stream);
        }

        Self { streams }
    }

    
    pub fn start_all(&self, source: &CameraSource) {
        for (camera_id, stream) in &self.streams {
            if stream.is_available() {
                if let Err(e) = stream.start(source) {
                    tracing::warn!("Failed to start stream for {}: {}", camera_id, e);
                }
            } else {
                tracing::warn!(
                    "V4L2 device not available for camera {} ({})",
                    camera_id,
                    stream.device_path
                );
            }
        }
    }

    
    pub fn stop_all(&self) {
        for stream in self.streams.values() {
            stream.stop();
        }
    }

    
    pub fn get(&self, camera_id: &str) -> Option<Arc<V4l2Stream>> {
        self.streams.get(camera_id).cloned()
    }

    
    pub fn set_source(&self, camera_id: &str, source: &CameraSource) -> anyhow::Result<()> {
        if let Some(stream) = self.streams.get(camera_id) {
            stream.set_source(source)
        } else {
            anyhow::bail!("Camera {} not found", camera_id)
        }
    }

    
    pub fn set_all_source(&self, source: &CameraSource) {
        for stream in self.streams.values() {
            if let Err(e) = stream.set_source(source) {
                tracing::warn!("Failed to set source: {}", e);
            }
        }
    }

    
    pub fn available_devices(&self) -> Vec<String> {
        self.streams
            .iter()
            .filter(|(_, s)| s.is_available())
            .map(|(id, _)| id.clone())
            .collect()
    }

    
    pub fn status(&self) -> HashMap<String, bool> {
        self.streams
            .iter()
            .map(|(id, s)| (id.clone(), s.is_running()))
            .collect()
    }
}