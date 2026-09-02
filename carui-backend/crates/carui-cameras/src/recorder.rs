use anyhow::{Context, Result};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

pub struct VideoRecorder {
    process: Option<Child>,
    output_dir: PathBuf,
    segment_duration_secs: u64,
}

impl VideoRecorder {
    pub fn new(output_dir: impl AsRef<Path>, segment_duration_secs: u64) -> Self {
        Self {
            process: None,
            output_dir: output_dir.as_ref().to_path_buf(),
            segment_duration_secs,
        }
    }

    pub fn push_frame(&mut self, frame: &[u8], width: u32, height: u32, fps: u32) -> Result<()> {
        if self.process.is_none() {
            self.start_process(width, height, fps)?;
        }

        if let Some(child) = self.process.as_mut() {
            if let Some(stdin) = child.stdin.as_mut() {
                if stdin.write_all(frame).is_err() {
                    self.process = None;
                }
            }
        }
        Ok(())
    }

    fn start_process(&mut self, width: u32, height: u32, fps: u32) -> Result<()> {
        std::fs::create_dir_all(&self.output_dir)?;

        let file_pattern = self.output_dir.join("%Y-%m-%d_%H-%M-%S.mp4");
        let pattern_str = file_pattern.to_str().unwrap();
        let seg_time = self.segment_duration_secs.to_string();

        let child = Command::new("ffmpeg")
            .args([
                "-y",
                "-f", "rawvideo",
                "-pixel_format", "rgb24",
                "-video_size", &format!("{}x{}", width, height),
                "-framerate", &fps.to_string(),
                "-i", "-",

                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-crf", "28",
                "-pix_fmt", "yuv420p",

                "-f", "segment",
                "-segment_time", &seg_time,
                "-segment_format", "mp4",
                "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof+dash",
                "-reset_timestamps", "1",
                "-strftime", "1",

                pattern_str
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to spawn ffmpeg")?;

        self.process = Some(child);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.process.take() {
            drop(child.stdin.take());
            let _ = child.wait();
            self.cleanup_empty_files();
        }
    }

    
    fn cleanup_empty_files(&self) {
        const MIN_VALID_SIZE: u64 = 51_200;
        if let Ok(entries) = std::fs::read_dir(&self.output_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.len() < MIN_VALID_SIZE {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}
