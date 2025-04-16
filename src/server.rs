use std::path::PathBuf;
use std::sync::Arc;
use std::fs as std_fs;
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
    tag: Option<String>,
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AddTagsRequest {
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CreateCategoryRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
struct RemoveTagsRequest {
    tags: Vec<String>,
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
        .route("/search", get(search_files))
        .route("/tags/:filename", put(add_tags))
        .route("/tags/:filename", delete(remove_tags))
        .route("/category", post(create_category))
        .route("/category/:category_name", delete(delete_category))
        .route("/categories", get(list_categories));
    
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
    
    // Print a clear message showing the URL for users
    println!("\n=======================================================");
    println!("🚀 mdlib server is running at: http://{}", addr);
    println!("=======================================================");
    println!("📝 Open this URL in your browser to access your Personal Wiki");
    println!("💡 Press Ctrl+C to stop the server");
    println!("=======================================================\n");
    
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
    // First, try to find the file directly at the path given
    let direct_path = state.base_dir.join(&filename);
    
    // Check if file exists and is a markdown file
    if direct_path.is_file() {
        // Verify it's a markdown file or at least has no extension (like README)
        if let Some(ext) = direct_path.extension() {
            if ext != "md" {
                return ApiResult::Error(StatusCode::NOT_FOUND, "Not a markdown file".to_string());
            }
        }
        
        return match fs::read_markdown_file(&direct_path) {
            Ok(content) => ApiResult::Success(StatusCode::OK, content),
            Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
        };
    }
    
    // If the direct path doesn't work, the file might be in a category folder
    // First, try to handle it as a path with slashes or backslashes
    let path_parts: Vec<&str> = filename.split(['/', '\\']).collect();
    if path_parts.len() > 1 {
        let combined_path = state.base_dir.join(&filename);
        if combined_path.is_file() {
            return match fs::read_markdown_file(&combined_path) {
                Ok(content) => ApiResult::Success(StatusCode::OK, content),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // Last resort: search for the file by name in all categories
    // First, get a list of all markdown files
    let all_files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    
    // Try to find a file with a matching name
    let file_name_buf = PathBuf::from(&filename);
    let file_name = file_name_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename);
    
    for file in all_files {
        let curr_file_name = file.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if curr_file_name == file_name || curr_file_name.to_lowercase() == file_name.to_lowercase() {
            return match fs::read_markdown_file(&file.path) {
                Ok(content) => ApiResult::Success(StatusCode::OK, content),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If we get here, we couldn't find the file
    ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string())
}

/// Create a new markdown file
async fn create_file(
    State(state): State<AppState>,
    Json(request): Json<CreateFileRequest>,
) -> impl IntoResponse {
    let name = request.name.trim();
    if name.is_empty() {
        return ApiResult::Error(StatusCode::BAD_REQUEST, "Filename cannot be empty".to_string());
    }
    
    // Extract category from the frontmatter if it exists
    let mut category_path = PathBuf::new();
    
    // Check if content has frontmatter with a category
    if let Some(category) = extract_category_from_content(&request.content) {
        // Make sure the category directory exists
        match fs::create_category(&state.base_dir, &category) {
            Ok(path) => {
                category_path = path;
                println!("Using category: {}, path: {:?}", category, category_path);
            },
            Err(err) => {
                return ApiResult::Error(
                    StatusCode::INTERNAL_SERVER_ERROR, 
                    format!("Failed to create category directory: {}", err)
                );
            }
        }
    }
    
    // Create the file in the appropriate location
    let file_path = if category_path.as_os_str().is_empty() {
        // No category, create in base directory
        match fs::create_markdown_file(&state.base_dir, name, &request.content) {
            Ok(path) => path,
            Err(err) => {
                return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string());
            }
        }
    } else {
        // Create in category directory
        match fs::create_markdown_file(&category_path, name, &request.content) {
            Ok(path) => path,
            Err(err) => {
                return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string());
            }
        }
    };
    
    // Return the relative path
    match fs::get_relative_path(&state.base_dir, &file_path) {
        Ok(rel_path) => {
            ApiResult::Success(StatusCode::CREATED, rel_path.to_string_lossy().into_owned())
        },
        Err(err) => {
            ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
        }
    }
}

// Helper function to extract category from content
fn extract_category_from_content(content: &str) -> Option<String> {
    if let Some(frontmatter) = extract_frontmatter(content) {
        for line in frontmatter.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("category:") {
                return Some(stripped.trim().to_string());
            }
        }
    }
    None
}

// Extract YAML frontmatter from markdown content if present
fn extract_frontmatter(content: &str) -> Option<String> {
    let trimmed = content.trim_start();
    if let Some(stripped) = trimmed.strip_prefix("---") {
        if let Some(end_index) = stripped.find("---") {
            return Some(stripped[..end_index].trim().to_string());
        }
    }
    None
}

/// Update an existing file
async fn update_file(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
    Json(request): Json<UpdateFileRequest>,
) -> impl IntoResponse {
    // First, try direct path
    let direct_path = state.base_dir.join(&filename);
    
    if direct_path.is_file() {
        // Verify it's a markdown file or README
        let is_readme = direct_path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_lowercase().starts_with("readme"))
            .unwrap_or(false);
            
        if is_readme || direct_path.extension().is_some_and(|ext| ext == "md") {
            return match fs::write_markdown_file(&direct_path, &request.content) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "File updated".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If direct path doesn't work, the file might be in a category folder
    // Try to handle it as a path with slashes or backslashes
    let path_parts: Vec<&str> = filename.split(['/', '\\']).collect();
    if path_parts.len() > 1 {
        let combined_path = state.base_dir.join(&filename);
        if combined_path.is_file() {
            // Verify it's a markdown file
            if combined_path.extension().is_some_and(|ext| ext == "md") {
                return match fs::write_markdown_file(&combined_path, &request.content) {
                    Ok(_) => ApiResult::Success(StatusCode::OK, "File updated".to_string()),
                    Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
                };
            }
        }
    }
    
    // Last resort: search for the file in all directories
    // Get all markdown files
    let all_files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    
    // Try to find a file with a matching name
    let file_name_buf = PathBuf::from(&filename);
    let file_name = file_name_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename);
    
    for file in all_files {
        let curr_file_name = file.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if curr_file_name == file_name || curr_file_name.to_lowercase() == file_name.to_lowercase() {
            return match fs::write_markdown_file(&file.path, &request.content) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "File updated".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If we get here, we couldn't find the file
    ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string())
}

/// Delete a file
async fn delete_file(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
) -> impl IntoResponse {
    // First, try direct path
    let direct_path = state.base_dir.join(&filename);
    
    if direct_path.is_file() {
        // Verify it's a markdown file or README
        let is_readme = direct_path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_lowercase().starts_with("readme"))
            .unwrap_or(false);
            
        if is_readme || direct_path.extension().is_some_and(|ext| ext == "md") {
            return match fs::delete_markdown_file(&direct_path) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "File deleted".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If direct path doesn't work, try handling it as a path with slashes or backslashes
    let path_parts: Vec<&str> = filename.split(['/', '\\']).collect();
    if path_parts.len() > 1 {
        let combined_path = state.base_dir.join(&filename);
        if combined_path.is_file() {
            // Verify it's a markdown file
            if combined_path.extension().is_some_and(|ext| ext == "md") {
                return match fs::delete_markdown_file(&combined_path) {
                    Ok(_) => ApiResult::Success(StatusCode::OK, "File deleted".to_string()),
                    Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
                };
            }
        }
    }
    
    // Last resort: search for the file in all directories
    let all_files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    
    // Try to find a file with a matching name
    let file_name_buf = PathBuf::from(&filename);
    let file_name = file_name_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename);
    
    for file in all_files {
        let curr_file_name = file.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if curr_file_name == file_name || curr_file_name.to_lowercase() == file_name.to_lowercase() {
            return match fs::delete_markdown_file(&file.path) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "File deleted".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If we get here, we couldn't find the file
    ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string())
}

/// Search for files containing a query
async fn search_files(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    // Get all markdown files
    let files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => {
            return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string());
        }
    };
    
    // Filter files by the search criteria
    let mut matching_files = Vec::new();
    
    for file in files {
        let mut matches = true;
        
        // Filter by text content if search term is provided
        if let Some(term) = &query.q {
            if !term.trim().is_empty() {
                if let Ok(content) = fs::read_markdown_file(&file.path) {
                    if !content.to_lowercase().contains(&term.to_lowercase()) {
                        matches = false;
                    }
                } else {
                    matches = false;
                }
            }
        }
        
        // Filter by tag if provided
        if let Some(tag) = &query.tag {
            if !file.tags.iter().any(|t| t.to_lowercase() == tag.to_lowercase()) {
                matches = false;
            }
        }
        
        // Filter by category if provided
        if let Some(category) = &query.category {
            match &file.category {
                Some(file_category) if file_category.to_lowercase() == category.to_lowercase() => {
                    // Category matches
                },
                _ => {
                    matches = false;
                }
            }
        }
        
        if matches {
            matching_files.push(file);
        }
    }
    
    ApiResult::Success(StatusCode::OK, matching_files)
}

/// Add tags to a file
async fn add_tags(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
    Json(request): Json<AddTagsRequest>,
) -> impl IntoResponse {
    // First, try direct path
    let direct_path = state.base_dir.join(&filename);
    
    if direct_path.is_file() {
        // Verify it's a markdown file or README
        let is_readme = direct_path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_lowercase().starts_with("readme"))
            .unwrap_or(false);
            
        if is_readme || direct_path.extension().is_some_and(|ext| ext == "md") {
            return match fs::add_tags_to_file(&direct_path, &request.tags) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "Tags added".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If direct path doesn't work, try handling it as a path with slashes or backslashes
    let path_parts: Vec<&str> = filename.split(['/', '\\']).collect();
    if path_parts.len() > 1 {
        let combined_path = state.base_dir.join(&filename);
        if combined_path.is_file() {
            // Verify it's a markdown file
            if combined_path.extension().is_some_and(|ext| ext == "md") {
                return match fs::add_tags_to_file(&combined_path, &request.tags) {
                    Ok(_) => ApiResult::Success(StatusCode::OK, "Tags added".to_string()),
                    Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
                };
            }
        }
    }
    
    // Last resort: search for the file in all directories
    let all_files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    
    // Try to find a file with a matching name
    let file_name_buf = PathBuf::from(&filename);
    let file_name = file_name_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename);
    
    for file in all_files {
        let curr_file_name = file.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if curr_file_name == file_name || curr_file_name.to_lowercase() == file_name.to_lowercase() {
            return match fs::add_tags_to_file(&file.path, &request.tags) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "Tags added".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If we get here, we couldn't find the file
    ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string())
}

/// Create a new category
async fn create_category(
    State(state): State<AppState>,
    Json(request): Json<CreateCategoryRequest>,
) -> impl IntoResponse {
    // Validate the category name
    let name = request.name.trim();
    if name.is_empty() {
        return ApiResult::Error(StatusCode::BAD_REQUEST, "Category name cannot be empty".to_string());
    }
    
    // Create the category directory
    match fs::create_category(&state.base_dir, name) {
        Ok(_) => ApiResult::Success(StatusCode::CREATED, name.to_string()),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
}

/// List all categories
async fn list_categories(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let base_dir = &state.base_dir;
    
    // Get all markdown files to extract unique categories
    let files = match fs::list_markdown_files(base_dir) {
        Ok(files) => files,
        Err(err) => {
            return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string());
        }
    };
    
    // Extract unique categories from files
    let mut categories = Vec::new();
    for file in &files {
        if let Some(category) = &file.category {
            if !categories.contains(category) {
                categories.push(category.clone());
            }
        }
    }
    
    // Also scan for directories that might be empty categories
    if let Ok(entries) = std_fs::read_dir(base_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        // Skip hidden directories
                        if !name.starts_with('.') {
                            let category = name.to_string();
                            if !categories.contains(&category) {
                                categories.push(category);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Sort categories
    categories.sort();
    
    ApiResult::Success(StatusCode::OK, categories)
}

/// Remove tags from a file
async fn remove_tags(
    State(state): State<AppState>,
    AxumPath(filename): AxumPath<String>,
    Json(request): Json<RemoveTagsRequest>,
) -> impl IntoResponse {
    // First, try direct path
    let direct_path = state.base_dir.join(&filename);
    
    if direct_path.is_file() {
        // Verify it's a markdown file or README
        let is_readme = direct_path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_lowercase().starts_with("readme"))
            .unwrap_or(false);
            
        if is_readme || direct_path.extension().is_some_and(|ext| ext == "md") {
            return match fs::remove_tags_from_file(&direct_path, &request.tags) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "Tags removed".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If direct path doesn't work, try handling it as a path with slashes or backslashes
    let path_parts: Vec<&str> = filename.split(['/', '\\']).collect();
    if path_parts.len() > 1 {
        let combined_path = state.base_dir.join(&filename);
        if combined_path.is_file() {
            // Verify it's a markdown file
            if combined_path.extension().is_some_and(|ext| ext == "md") {
                return match fs::remove_tags_from_file(&combined_path, &request.tags) {
                    Ok(_) => ApiResult::Success(StatusCode::OK, "Tags removed".to_string()),
                    Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
                };
            }
        }
    }
    
    // Last resort: search for the file in all directories
    let all_files = match fs::list_markdown_files(&state.base_dir) {
        Ok(files) => files,
        Err(err) => return ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    };
    
    // Try to find a file with a matching name
    let file_name_buf = PathBuf::from(&filename);
    let file_name = file_name_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename);
    
    for file in all_files {
        let curr_file_name = file.path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        if curr_file_name == file_name || curr_file_name.to_lowercase() == file_name.to_lowercase() {
            return match fs::remove_tags_from_file(&file.path, &request.tags) {
                Ok(_) => ApiResult::Success(StatusCode::OK, "Tags removed".to_string()),
                Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            };
        }
    }
    
    // If we get here, we couldn't find the file
    ApiResult::Error(StatusCode::NOT_FOUND, "File not found".to_string())
}

/// Delete a category 
async fn delete_category(
    State(state): State<AppState>,
    AxumPath(category_name): AxumPath<String>,
) -> impl IntoResponse {
    // Validate the category name
    let name = category_name.trim();
    if name.is_empty() {
        return ApiResult::Error(StatusCode::BAD_REQUEST, "Category name cannot be empty".to_string());
    }
    
    // Check if the category exists and delete it
    match fs::delete_category(&state.base_dir, name) {
        Ok(_) => ApiResult::Success(StatusCode::OK, format!("Category '{}' deleted", name)),
        Err(err) => ApiResult::Error(StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
    }
} 