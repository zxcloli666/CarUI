use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use image::RgbImage;
use parking_lot::Mutex;
use tokio::sync::broadcast;

use fast_image_resize::images::Image;
use fast_image_resize::{Resizer, ResizeAlg, ResizeOptions, FilterType, PixelType};

use crate::capture::CameraWorker;
use crate::config::Config;
use crate::overlay::OverlayRenderer;
use crate::recorder::VideoRecorder;

#[derive(Clone)]
pub struct StreamFrame {
    pub data: Arc<Vec<u8>>,
}

pub struct Pipeline {
    config: Config,
    is_running: AtomicBool,
    is_recording: AtomicBool,
    streams: HashMap<String, broadcast::Sender<StreamFrame>>,
    recorder: Arc<Mutex<VideoRecorder>>,
    workers: Vec<CameraWorker>,
}

impl Pipeline {
    pub fn new(config: Config) -> Arc<Self> {
        let mut streams = HashMap::new();
        let mut workers = Vec::new();

        for cam_cfg in &config.cameras {
            let (tx, _) = broadcast::channel(16);
            streams.insert(cam_cfg.id.clone(), tx);
            workers.push(CameraWorker::new(cam_cfg.clone()));
        }

        let recorder = VideoRecorder::new(config.recordings_path.join("raw"), config.segment_duration_secs);

        Arc::new(Self {
            config: config.clone(),
            is_running: AtomicBool::new(true),
            is_recording: AtomicBool::new(config.auto_record),
            streams,
            recorder: Arc::new(Mutex::new(recorder)),
            workers,
        })
    }

    pub fn start(self: &Arc<Self>) {
        let mut receivers = HashMap::new();

        for worker in &self.workers {
            let rx = worker.start();
            receivers.insert(worker.config.id.clone(), rx);
        }

        let pipeline = self.clone();

        thread::spawn(move || {
            pipeline.mixer_loop(receivers);
        });
    }

    pub fn subscribe(&self, camera_id: &str) -> Option<broadcast::Receiver<StreamFrame>> {
        self.streams.get(camera_id).map(|tx| tx.subscribe())
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn set_recording(&self, enable: bool) {
        self.is_recording.store(enable, Ordering::SeqCst);
        if !enable {
            self.recorder.lock().stop();
        }
    }

    pub fn stop(&self) {
        tracing::info!("Stopping pipeline and workers...");
        self.is_running.store(false, Ordering::SeqCst);

        
        for worker in &self.workers {
            worker.stop();
        }

        
        self.recorder.lock().stop();
    }

    fn mixer_loop(&self, receivers: HashMap<String, crossbeam_channel::Receiver<RgbImage>>) {
        let canvas_w = self.config.output_width;
        let canvas_h = self.config.output_height;
        let target_fps = self.config.output_fps;

        let grid_map = self.calculate_grid_layout(canvas_w, canvas_h);

        let mut last_frames: HashMap<String, RgbImage> = HashMap::new();
        let mut canvas = RgbImage::new(canvas_w, canvas_h);

        let mut resizer = Resizer::new();
        let resize_opts = ResizeOptions::new()
            .resize_alg(ResizeAlg::Convolution(FilterType::Bilinear));

        let frame_duration = Duration::from_micros(1_000_000 / target_fps as u64);

        tracing::info!("Mixer started: {}x{} @ {} fps", canvas_w, canvas_h, target_fps);

        while self.is_running.load(Ordering::SeqCst) {
            let loop_start = Instant::now();
            let recording_active = self.is_recording.load(Ordering::SeqCst);

            
            for cam in &self.config.cameras {
                if let Some(rx) = receivers.get(&cam.id) {
                    if let Ok(frame) = rx.try_recv() {
                        
                        if let Some(tx) = self.streams.get(&cam.id) {
                            if tx.receiver_count() > 0 {
                                let mut buf = Vec::new();
                                let mut enc = image::codecs::jpeg::JpegEncoder::new(&mut buf);
                                let _ = enc.encode_image(&frame);
                                let _ = tx.send(StreamFrame { data: Arc::new(buf) });
                            }
                        }
                        last_frames.insert(cam.id.clone(), frame);
                    }
                }
            }

            
            if recording_active {
                
                for cam in &self.config.cameras {
                    if let Some(frame) = last_frames.get_mut(&cam.id) {
                        if let Some((dst_x, dst_y, dst_w, dst_h)) = grid_map.get(&cam.id) {

                            let src_width = frame.width();
                            let src_height = frame.height();

                            
                            
                            if let Ok(src_image) = Image::from_slice_u8(
                                src_width,
                                src_height,
                                frame.as_mut(),
                                PixelType::U8x3,
                            ) {
                                
                                let mut dst_image = Image::new(
                                    *dst_w,
                                    *dst_h,
                                    PixelType::U8x3
                                );

                                
                                if let Ok(_) = resizer.resize(&src_image, &mut dst_image, &resize_opts) {
                                    copy_to_canvas(&mut canvas, dst_image.buffer(), *dst_x, *dst_y, *dst_w, *dst_h);
                                }
                            }
                        }
                    }
                }

                OverlayRenderer::draw(&mut canvas);

                let raw = canvas.as_raw();
                let mut rec = self.recorder.lock();
                
                
                if self.is_recording.load(Ordering::SeqCst) {
                    let _ = rec.push_frame(raw, canvas_w, canvas_h, target_fps);
                }
            }

            let elapsed = loop_start.elapsed();
            if elapsed < frame_duration {
                thread::sleep(frame_duration - elapsed);
            }
        }

        tracing::info!("Mixer loop exited.");
    }

    fn calculate_grid_layout(&self, total_w: u32, total_h: u32) -> HashMap<String, (u32, u32, u32, u32)> {
        let count = self.config.cameras.len();
        let mut map = HashMap::new();

        if count == 0 { return map; }

        if count == 1 {
            map.insert(self.config.cameras[0].id.clone(), (0, 0, total_w, total_h));
            return map;
        }

        let cell_w = total_w / 2;
        let cell_h = total_h / 2;

        for c in &self.config.cameras {
            let (x, y) = match c.grid_index {
                0 => (0, 0),
                1 => (cell_w, 0),
                2 => (0, cell_h),
                _ => (cell_w, cell_h),
            };
            map.insert(c.id.clone(), (x, y, cell_w, cell_h));
        }

        map
    }
}

fn copy_to_canvas(canvas: &mut RgbImage, src_buf: &[u8], x: u32, y: u32, w: u32, h: u32) {
    let canvas_width = canvas.width();

    
    let samples = canvas.as_flat_samples_mut();
    let canvas_buf = samples.samples;

    let row_size = (w * 3) as usize;

    for row in 0..h {
        let src_start = (row * w * 3) as usize;
        let src_end = src_start + row_size;

        let dst_row = y + row;
        let dst_start = (dst_row * canvas_width * 3 + (x * 3)) as usize;

        if src_end <= src_buf.len() && dst_start + row_size <= canvas_buf.len() {
            canvas_buf[dst_start..dst_start + row_size].copy_from_slice(&src_buf[src_start..src_end]);
        }
    }
}