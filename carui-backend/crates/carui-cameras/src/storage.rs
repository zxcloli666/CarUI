use anyhow::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RecordingSource {
    Raw,
    Video,
}

#[derive(Serialize)]
pub struct RecordingInfo {
    pub id: String,
    pub filename: String,
    pub size: u64,
    pub source: RecordingSource,
}

pub struct StorageManager {
    base_path: PathBuf,
    max_gb: u64,
}

impl StorageManager {
    pub fn new(path: impl AsRef<Path>, max_gb: u64) -> Result<Self> {
        let base = path.as_ref().to_path_buf();
        std::fs::create_dir_all(base.join("raw"))?;
        std::fs::create_dir_all(base.join("videos"))?;
        Ok(Self { base_path: base, max_gb })
    }

    pub fn raw_dir(&self) -> PathBuf {
        self.base_path.join("raw")
    }

    pub fn videos_dir(&self) -> PathBuf {
        self.base_path.join("videos")
    }

    pub fn list_recordings(&self) -> Result<Vec<RecordingInfo>> {
        let mut files_map = std::collections::HashMap::new();

        
        self.scan_dir(&self.videos_dir(), RecordingSource::Video, &mut files_map)?;
        
        self.scan_dir(&self.raw_dir(), RecordingSource::Raw, &mut files_map)?;

        let mut files: Vec<RecordingInfo> = files_map.into_values().collect();
        files.sort_by(|a, b| b.id.cmp(&a.id));
        Ok(files)
    }

    fn scan_dir(
        &self,
        dir: &Path,
        source: RecordingSource,
        map: &mut std::collections::HashMap<String, RecordingInfo>,
    ) -> Result<()> {
        if !dir.exists() { return Ok(()); }

        for entry in WalkDir::new(dir).min_depth(1).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file()
                && entry.path().extension().map_or(false, |e| e == "mp4")
            {
                let filename = entry.file_name().to_string_lossy().into_owned();
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let id = filename.clone();

                map.insert(id.clone(), RecordingInfo { id, filename, size, source });
            }
        }
        Ok(())
    }

    
    pub fn get_file_path(&self, id: &str) -> Option<(PathBuf, RecordingSource)> {
        let filename = Path::new(id).file_name()?.to_str()?;

        let raw_path = self.raw_dir().join(filename);
        if raw_path.exists() {
            return Some((raw_path, RecordingSource::Raw));
        }

        let video_path = self.videos_dir().join(filename);
        if video_path.exists() {
            return Some((video_path, RecordingSource::Video));
        }

        None
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let filename = Path::new(id).file_name()
            .ok_or_else(|| anyhow::anyhow!("invalid id"))?;

        
        let raw = self.raw_dir().join(filename);
        let video = self.videos_dir().join(filename);

        if raw.exists() { std::fs::remove_file(raw)?; }
        if video.exists() { std::fs::remove_file(video)?; }

        Ok(())
    }

    pub async fn run_cleanup_loop(&self) {
        loop {
            if let Err(e) = self.cleanup() {
                tracing::error!("Cleanup failed: {}", e);
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
        }
    }

    fn cleanup(&self) -> Result<()> {
        let max_bytes = self.max_gb * 1024 * 1024 * 1024;
        let mut files: Vec<(PathBuf, u64)> = Vec::new();
        let mut total_size = 0;

        for dir in [self.raw_dir(), self.videos_dir()] {
            for entry in WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let size = entry.metadata()?.len();
                    total_size += size;
                    files.push((entry.path().to_path_buf(), size));
                }
            }
        }

        
        files.sort_by(|a, b| {
            let name_a = a.0.file_name().unwrap_or_default();
            let name_b = b.0.file_name().unwrap_or_default();
            name_a.cmp(&name_b)
        });

        for (path, size) in files {
            if total_size <= max_bytes { break; }
            if std::fs::remove_file(&path).is_ok() {
                total_size -= size;
                tracing::info!("Deleted old recording: {:?}", path);
            }
        }
        Ok(())
    }

}
