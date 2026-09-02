use anyhow::{Context, Result};
use image::RgbImage;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use v4l::buffer::Type;
use v4l::io::traits::CaptureStream;
use v4l::video::Capture;
use v4l::Device;
use v4l::prelude::*;
use v4l::FourCC;

use crate::config::CameraConfig;

pub struct CameraWorker {
    pub config: CameraConfig,
    running: Arc<AtomicBool>,
}

impl CameraWorker {
    pub fn new(config: CameraConfig) -> Self {
        Self {
            config,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self) -> crossbeam_channel::Receiver<RgbImage> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let config = self.config.clone();
        let running = self.running.clone();

        running.store(true, Ordering::SeqCst);

        thread::spawn(move || {
            tracing::info!("Starting capture for {}", config.device);
            while running.load(Ordering::SeqCst) {
                if let Err(e) = capture_loop(&config, &tx, &running) {
                    tracing::error!("Capture error [{}]: {}. Retry in 2s...", config.id, e);
                    thread::sleep(Duration::from_secs(2));
                }
            }
        });

        rx
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

fn capture_loop(
    config: &CameraConfig,
    tx: &crossbeam_channel::Sender<RgbImage>,
    running: &Arc<AtomicBool>,
) -> Result<()> {
    let mut dev = Device::with_path(&config.device)?;

    let mut format = dev.format()?;
    format.width = config.width;
    format.height = config.height;
    format.fourcc = FourCC::new(b"MJPG");

    
    let format = match dev.set_format(&format) {
        Ok(f) => f,
        Err(_) => {
            tracing::warn!("[{}] MJPG failed, trying YUYV", config.id);
            format.fourcc = FourCC::new(b"YUYV");
            dev.set_format(&format).context("Failed to set YUYV")?
        }
    };

    let params = dev.params()?;
    let mut params = params;
    params.interval = v4l::fraction::Fraction { numerator: 1, denominator: config.fps };
    let _ = dev.set_params(&params);

    let mut stream = MmapStream::with_buffers(&mut dev, Type::VideoCapture, 4)?;

    while running.load(Ordering::SeqCst) {
        let (buf, _) = stream.next()?;

        let img = match format.fourcc.repr {
            [b'M', b'J', b'P', b'G'] => {
                image::load_from_memory_with_format(buf, image::ImageFormat::Jpeg)
                    .map(|i| i.to_rgb8())
                    .ok()
            },
            [b'Y', b'U', b'Y', b'V'] => {
                yuyv_to_rgb(buf, format.width, format.height)
            },
            _ => None,
        };

        if let Some(rgb) = img {
            let _ = tx.try_send(rgb);
        }
    }
    Ok(())
}

fn yuyv_to_rgb(buf: &[u8], width: u32, height: u32) -> Option<RgbImage> {
    let size = (width * height * 3) as usize;
    let mut rgb = Vec::with_capacity(size);

    
    for chunk in buf.chunks_exact(4) {
        let y0 = chunk[0] as i32;
        let u  = chunk[1] as i32 - 128;
        let y1 = chunk[2] as i32;
        let v  = chunk[3] as i32 - 128;

        let r0 = (y0 + (1.370705 * v as f32) as i32).clamp(0, 255) as u8;
        let g0 = (y0 - (0.337633 * u as f32) as i32 - (0.698001 * v as f32) as i32).clamp(0, 255) as u8;
        let b0 = (y0 + (1.732446 * u as f32) as i32).clamp(0, 255) as u8;

        let r1 = (y1 + (1.370705 * v as f32) as i32).clamp(0, 255) as u8;
        let g1 = (y1 - (0.337633 * u as f32) as i32 - (0.698001 * v as f32) as i32).clamp(0, 255) as u8;
        let b1 = (y1 + (1.732446 * u as f32) as i32).clamp(0, 255) as u8;

        rgb.extend_from_slice(&[r0, g0, b0, r1, g1, b1]);
    }

    RgbImage::from_raw(width, height, rgb)
}