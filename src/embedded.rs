use axum::{
    body::Body,
    http::{header, Response, StatusCode},
    response::IntoResponse,
};
use rust_embed::RustEmbed;
use std::{borrow::Cow, future::Future, pin::Pin};
use tracing::{debug, warn};

#[derive(RustEmbed)]
#[folder = "static/"]
pub struct StaticAssets;

pub fn serve_embedded_file(path: &str) -> Pin<Box<dyn Future<Output = impl IntoResponse> + Send>> {
    let path_owned = path.to_string();
    Box::pin(async move {
        let path = if path_owned.is_empty() || path_owned == "/" {
            debug!("Serving root path as index.html");
            "index.html".to_string()
        } else {
            // Remove leading slash if present
            if path_owned.starts_with('/') {
                path_owned[1..].to_string()
            } else {
                path_owned
            }
        };

        debug!("Attempting to serve embedded file: {}", path);
        
        match StaticAssets::get(&path) {
            Some(content) => {
                let mime_type = mime_guess::from_path(&path)
                    .first_or_octet_stream()
                    .as_ref()
                    .to_string();

                debug!("Found embedded file: {} (MIME: {})", path, mime_type);
                
                let mut response = Response::builder()
                    .header(header::CONTENT_TYPE, mime_type);

                // Add caching headers for non-HTML files
                if !path.ends_with(".html") {
                    response = response
                        .header(header::CACHE_CONTROL, "public, max-age=604800");
                }

                let body = match content.data {
                    Cow::Borrowed(bytes) => Body::from(bytes.to_vec()),
                    Cow::Owned(bytes) => Body::from(bytes),
                };

                response
                    .body(body)
                    .unwrap_or_else(|_| {
                        warn!("Failed to build response for embedded file: {}", path);
                        Response::new(Body::empty())
                    })
            }
            None => {
                // Check if this is a JS or CSS file and try with appropriate subfolder
                if path.ends_with(".js") && !path.starts_with("js/") {
                    debug!("Trying to find JS file in js/ subfolder");
                    let js_path = format!("js/{}", path);
                    let future = serve_embedded_file(&js_path);
                    return future.await;
                } else if path.ends_with(".css") && !path.starts_with("css/") {
                    debug!("Trying to find CSS file in css/ subfolder");
                    let css_path = format!("css/{}", path);
                    let future = serve_embedded_file(&css_path);
                    return future.await;
                }
                
                warn!("Embedded file not found: {}", path);
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Body::from(format!("File not found: {}", path)))
                    .unwrap()
            }
        }
    })
}

// Handler for all embedded static assets
pub async fn static_handler(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    serve_embedded_file(path).await
}

// Function to verify that essential files are embedded
pub fn verify_essential_files() -> Result<(), Vec<&'static str>> {
    let essential_files = vec![
        "index.html",
        "js/app.js",
        "css/styles.css",
    ];
    
    let missing_files: Vec<&str> = essential_files
        .into_iter()
        .filter(|file| StaticAssets::get(*file).is_none())
        .collect();
    
    if missing_files.is_empty() {
        Ok(())
    } else {
        Err(missing_files)
    }
}

// Function to list all embedded files for debugging
pub fn list_embedded_files() -> Vec<String> {
    StaticAssets::iter()
        .map(|path| path.to_string())
        .collect()
} 