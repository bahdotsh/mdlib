use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use axum::{
    extract::{Path as AxumPath, State, Query},
    response::IntoResponse,
    routing::{get, post, put, delete},
    Router, Json, http::StatusCode,
};
use tower_http::services::ServeDir;
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::fs;
use crate::config::AppConfig;

// Define API types
#[derive(Debug, Serialize)]
struct ApiResponse<T> {
    status: String,
    data: T,
}

#[derive(Debug, Serialize)]
struct ApiError {
    status: String,
    message: String,
}

// Single response type to handle both success and error cases
enum ApiResult<T> {
    Success(StatusCode, T),
    Error(StatusCode, String),
}

impl<T: Serialize> IntoResponse for ApiResult<T> {
    fn into_response(self) -> axum::response::Response {
        match self {
            ApiResult::Success(status, data) => {
                (
                    status,
                    Json(ApiResponse {
                        status: "success".to_string(),
                        data,
                    }),
                ).into_response()
            },
            ApiResult::Error(status, message) => {
                (
                    status,
                    Json(ApiError {
                        status: "error".to_string(),
                        message,
                    }),
                ).into_response()
            }
        }
    }
}

#[derive(Debug, Deserialize)]
struct CreateFileRequest {
    name: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct UpdateFileRequest {
    content: String,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

// App state
#[derive(Clone)]
struct AppState {
    base_dir: PathBuf,
    config: Arc<RwLock<AppConfig>>,
}

/// Start the web server
pub async fn start_server(base_dir: PathBuf) -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Load configuration
    let config_path = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mdlib/config.json");
    
    let config = AppConfig::load_or_default(&config_path)
        .context("Failed to load configuration")?;
    
    let app_state = AppState {
        base_dir,
        config: Arc::new(RwLock::new(config)),
    };
    
    // Define routes
    let api_routes = Router::new()
        .route("/files", get(list_files))
        .route("/files", post(create_file))
        .route("/files/:filename", get(get_file))
        .route("/files/:filename", put(update_file))
        .route("/files/:filename", delete(delete_file))
        .route("/search", get(search_files));
    
    // Combine API routes with static files
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("static"))
        .layer(TraceLayer::new_for_http())
        .with_state(app_state.clone());
    
    // Get the server address
    let addr = {
        let config = app_state.config.read().await;
        config.server_address().parse()
            .context("Invalid server address")?
    };
    
    info!("Starting server on {}", addr);
    
    // Start the server
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .context("Server error")
}

/// List all markdown files
async fn list_files(
    State(state): State<AppState>,
) -> impl IntoResponse {
    match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => ApiResult::Success(StatusCode::OK, files),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// Get the content of a file
async fn get_file(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
) -> impl IntoResponse {
    let path = state.base_dir.join(filename);
    
    if !path.is_file() || path.extension().map_or(false, |ext| ext != "md") {
        return ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string());
    }
    
    match fs::read_markdown_file(&path) {
        Ok(content) => ApiResult::Success(StatusCode::OK, content),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// Create a new file
async fn create_file(
    State(state): State<AppState>,
    Json(request): Json<CreateFileRequest>,
) -> impl IntoResponse {
    match fs::create_markdown_file(&state.base_dir, &request.name, &request.content) {
        Ok(path) => {
            let relative_path = match fs::get_relative_path(&state.base_dir, &path) {
                Ok(p) => p,
                Err(_) => path.clone(),
            };
            
            ApiResult::Success(StatusCode::CREATED, relative_path.to_string_lossy().to_string())
        },
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// Update an existing file
async fn update_file(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
    Json(request): Json<UpdateFileRequest>,
) -> impl IntoResponse {
    let path = state.base_dir.join(filename);
    
    if !path.is_file() || path.extension().map_or(false, |ext| ext != "md") {
        return ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string());
    }
    
    match fs::write_markdown_file(&path, &request.content) {
        Ok(_) => ApiResult::Success(StatusCode::OK, "File updated".to_string()),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// Delete a file
async fn delete_file(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
) -> impl IntoResponse {
    let path = state.base_dir.join(filename);
    
    if !path.is_file() || path.extension().map_or(false, |ext| ext != "md") {
        return ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string());
    }
    
    match fs::delete_markdown_file(&path) {
        Ok(_) => ApiResult::Success(StatusCode::OK, "File deleted".to_string()),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// Search for files containing a query
async fn search_files(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let search_term = match query.q {
        Some(term) if !term.trim().is_empty() => term,
        _ => {
            // If no search term, just return all files directly
            match fs::list_markdown_files(&state.base_dir) {
                Ok(files) => return ApiResult::Success(StatusCode::OK, files),
                Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            }
        }
    };
    
    // Get all markdown files
    let files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => {
            return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string());
        }
    };
    
    // Filter files that contain the search term
    let mut matching_files = Vec::new();
    for file in files {
        if let Ok(content) = fs::read_markdown_file(&file.path) {
            if content.to_lowercase().contains(&search_term.to_lowercase()) {
                matching_files.push(file);
            }
        }
    }
    
    ApiResult::Success(StatusCode::OK, matching_files)
} 