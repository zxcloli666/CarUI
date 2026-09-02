

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
};
use axum::extract::Query;
use futures_util::TryStreamExt;
use crate::AppState;


async fn proxy_request(
    state: &AppState,
    base_url: &str,
    path: &str,
    req: Request<Body>,
) -> Response {
    let url = format!("{}/{}", base_url.trim_end_matches('/'), path);

    let method = req.method().clone();
    let headers = req.headers().clone();

    
    let mut builder = state.http_client.request(method, &url);

    
    for (key, value) in headers.iter() {
        if key != "host" {
            builder = builder.header(key.clone(), value.clone());
        }
    }

    
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(e) => {
            tracing::error!("Failed to read request body: {}", e);
            return (StatusCode::BAD_REQUEST, "Failed to read body").into_response();
        }
    };

    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes);
    }

    
    match builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            let resp_headers = resp.headers().clone();

            
            let is_streaming = resp_headers
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .map(|ct| ct.contains("multipart") || ct.contains("event-stream"))
                .unwrap_or(false);

            if is_streaming {
                
                let stream = resp.bytes_stream().map_err(|e| {
                    std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
                });

                let mut response = Response::builder().status(status);
                for (key, value) in resp_headers.iter() {
                    response = response.header(key.clone(), value.clone());
                }

                response.body(Body::from_stream(stream)).unwrap_or_else(|_| {
                    (StatusCode::INTERNAL_SERVER_ERROR, "Response build error").into_response()
                })
            } else {
                
                match resp.bytes().await {
                    Ok(body) => {
                        let mut response = Response::builder().status(status);

                        for (key, value) in resp_headers.iter() {
                            response = response.header(key.clone(), value.clone());
                        }

                        response.body(Body::from(body)).unwrap_or_else(|_| {
                            (StatusCode::INTERNAL_SERVER_ERROR, "Response build error").into_response()
                        })
                    }
                    Err(e) => {
                        tracing::error!("Failed to read response body: {}", e);
                        (StatusCode::BAD_GATEWAY, "Failed to read response").into_response()
                    }
                }
            }
        }
        Err(e) => {
            tracing::warn!("Proxy request to {} failed: {}", url, e);
            (StatusCode::BAD_GATEWAY, format!("Service unavailable: {}", e)).into_response()
        }
    }
}

pub async fn gpio(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    Query(query): Query<HashMap<String, String>>,
    req: Request<Body>,
) -> Response {
    let full_url = convert_url(path, query);
    proxy_request(&state, &state.config.services.gpio, &full_url, req).await
}

pub async fn cameras(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    Query(query): Query<HashMap<String, String>>,
    req: Request<Body>,
) -> Response {
    let full_url = convert_url(path, query);
    proxy_request(&state, &state.config.services.cameras, &full_url, req).await
}


fn convert_url(
    path: String,
    query: HashMap<String, String>,
) -> String {
    format!("{}?{}", path,
            query
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect::<Vec<String>>()
                .join("&"))
}