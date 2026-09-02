use tokio::io::AsyncReadExt;
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum::body::Body;
use tokio::io::AsyncSeekExt;
use tokio_util::io::ReaderStream;
use std::sync::Arc;
use crate::AppState;
use crate::storage::RecordingSource;

pub async fn list(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.storage.list_recordings() {
        Ok(files) => Json(files).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn get_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    let Some((path, source)) = state.storage.get_file_path(&id) else {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    };

    let metadata = match tokio::fs::metadata(&path).await {
        Ok(m) => m,
        Err(_) => return (StatusCode::NOT_FOUND, "File not found").into_response(),
    };

    let total_size = metadata.len();
    let filename = path.file_name().unwrap().to_string_lossy();
    let source_str = match source {
        RecordingSource::Raw => "raw",
        RecordingSource::Video => "video",
    };

    
    if let Some(range_header) = headers.get(header::RANGE) {
        if let Ok(range_str) = range_header.to_str() {
            if let Some((start, end)) = parse_range(range_str, total_size) {
                let content_length = end - start + 1;

                let mut file = match tokio::fs::File::open(&path).await {
                    Ok(f) => f,
                    Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "File open error").into_response(),
                };

                if let Err(_) = file.seek(std::io::SeekFrom::Start(start)).await {
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Seek error").into_response();
                }

                let stream = ReaderStream::new(file.take(content_length));
                let body = Body::from_stream(stream);

                return Response::builder()
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header(header::CONTENT_TYPE, "video/mp4")
                    .header(header::CONTENT_LENGTH, content_length)
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, total_size))
                    .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
                    .header("X-Recording-Source", source_str)
                    .body(body)
                    .unwrap();
            }
        }
    }

    
    let file = match tokio::fs::File::open(&path).await {
        Ok(f) => f,
        Err(_) => return (StatusCode::NOT_FOUND, "File open error").into_response(),
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Response::builder()
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(header::CONTENT_LENGTH, total_size)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
        .header("X-Recording-Source", source_str)
        .body(body)
        .unwrap()
}


fn parse_range(range: &str, total: u64) -> Option<(u64, u64)> {
    let range = range.strip_prefix("bytes=")?;
    let parts: Vec<&str> = range.splitn(2, '-').collect();
    if parts.len() != 2 { return None; }

    let start: u64 = parts[0].parse().ok()?;
    let end: u64 = if parts[1].is_empty() {
        total - 1
    } else {
        parts[1].parse().ok()?
    };

    if start > end || start >= total { return None; }
    Some((start, end.min(total - 1)))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.storage.delete(&id) {
        Ok(_) => Json(serde_json::json!({"deleted": id})).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
