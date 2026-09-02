use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

const MAX_RETRIES: u32 = 3;
const MIN_VALID_SIZE: u64 = 51_200;


pub async fn convert_all(raw_dir: PathBuf, videos_dir: PathBuf) {
    let entries = match std::fs::read_dir(&raw_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut files: Vec<PathBuf> = entries
        .flatten()
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "mp4"))
        .map(|e| e.path())
        .collect();

    files.sort();

    if !files.is_empty() {
        tracing::info!("Converting {} raw recordings...", files.len());
    }

    for path in files {
        
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.len() < MIN_VALID_SIZE {
                let _ = std::fs::remove_file(&path);
                continue;
            }
        }

        if let Err(e) = convert_file(&path, &videos_dir).await {
            tracing::error!("Failed to convert {:?}: {}", path.file_name().unwrap_or_default(), e);
        }
    }
}








async fn convert_file(raw_path: &Path, videos_dir: &Path) -> Result<()> {
    let filename = raw_path.file_name().context("no filename")?;
    let output_path = videos_dir.join(filename);

    tokio::fs::create_dir_all(videos_dir).await?;

    
    if output_path.exists() && validate(&output_path).await {
        tokio::fs::remove_file(raw_path).await?;
        tracing::info!("Already converted, removed raw: {:?}", filename);
        return Ok(());
    }

    
    if output_path.exists() {
        let _ = tokio::fs::remove_file(&output_path).await;
    }

    for attempt in 1..=MAX_RETRIES {
        tracing::info!(
            "Converting {:?} (attempt {}/{})",
            filename, attempt, MAX_RETRIES
        );

        
        let mut child = Command::new("ffmpeg")
            .args([
                "-y",
                "-i", raw_path.to_str().unwrap(),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "28",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                output_path.to_str().unwrap(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .context("ffmpeg spawn failed")?;

        let status = child.wait().await?;

        if !status.success() {
            tracing::warn!("ffmpeg conversion failed for {:?}", filename);
            let _ = tokio::fs::remove_file(&output_path).await;
            continue;
        }

        if validate(&output_path).await {
            tokio::fs::remove_file(raw_path).await?;
            tracing::info!("Converted successfully: {:?}", filename);
            return Ok(());
        }

        tracing::warn!("Validation failed for {:?}, retrying...", filename);
        let _ = tokio::fs::remove_file(&output_path).await;
    }

    anyhow::bail!(
        "Conversion failed after {} attempts: {:?}",
        MAX_RETRIES, filename
    )
}


async fn validate(path: &Path) -> bool {
    let child = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,duration",
            "-of", "csv=p=0",
            path.to_str().unwrap_or_default(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn();

    let child = match child {
        Ok(c) => c,
        Err(_) => return false,
    };

    match child.wait_with_output().await {
        Ok(output) => output.status.success() && !output.stdout.is_empty(),
        Err(_) => false,
    }
}
