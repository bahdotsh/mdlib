use std::path::{Path, PathBuf};
use std::fs;
use std::io;
use walkdir::WalkDir;
use anyhow::{Result, Context};

/// Represents a markdown file
#[derive(Debug, Clone, serde::Serialize)]
pub struct MarkdownFile {
    pub path: PathBuf,
    pub name: String,
    pub modified: Option<u64>,
    pub size: u64,
}

/// Lists all markdown files in the given directory and its subdirectories
pub fn list_markdown_files(dir: &Path) -> Result<Vec<MarkdownFile>> {
    let mut files = Vec::new();
    
    for entry in WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Skip directories, only process files
        if !path.is_file() {
            continue;
        }
        
        // Special case for README files
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
            
        if file_name.eq_ignore_ascii_case("readme") || file_name.eq_ignore_ascii_case("readme.md") {
            let metadata = fs::metadata(path).context("Failed to read file metadata")?;
            let modified = metadata.modified()
                .ok()
                .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_secs()))
                .flatten();
            
            files.push(MarkdownFile {
                path: path.to_path_buf(),
                name: file_name.to_string(),
                modified,
                size: metadata.len(),
            });
            continue;
        }
        
        // Check if it's a markdown file with .md extension
        if let Some(ext) = path.extension() {
            if ext == "md" {
                let metadata = fs::metadata(path).context("Failed to read file metadata")?;
                let modified = metadata.modified()
                    .ok()
                    .map(|time| time.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| d.as_secs()))
                    .flatten();
                
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled.md")
                    .to_string();
                
                files.push(MarkdownFile {
                    path: path.to_path_buf(),
                    name,
                    modified,
                    size: metadata.len(),
                });
            }
        }
    }
    
    // Sort by name
    files.sort_by(|a, b| a.name.cmp(&b.name));
    
    Ok(files)
}

/// Reads the content of a markdown file (or README)
pub fn read_markdown_file(path: &Path) -> Result<String> {
    fs::read_to_string(path).context("Failed to read file")
}

/// Writes content to a markdown file
pub fn write_markdown_file(path: &Path, content: &str) -> Result<()> {
    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("Failed to create parent directories")?;
    }
    
    fs::write(path, content).context("Failed to write file")
}

/// Creates a new markdown file with the given name
pub fn create_markdown_file(dir: &Path, name: &str, content: &str) -> Result<PathBuf> {
    let file_name = if name.ends_with(".md") {
        name.to_string()
    } else {
        format!("{}.md", name)
    };
    
    let path = dir.join(file_name);
    
    write_markdown_file(&path, content)?;
    
    Ok(path)
}

/// Deletes a markdown file
pub fn delete_markdown_file(path: &Path) -> Result<()> {
    fs::remove_file(path).context("Failed to delete file")
}

/// Checks if a path exists
pub fn path_exists(path: &Path) -> bool {
    path.exists()
}

/// Gets the relative path from base directory
pub fn get_relative_path(base: &Path, path: &Path) -> Result<PathBuf> {
    match path.strip_prefix(base) {
        Ok(rel_path) => Ok(rel_path.to_path_buf()),
        Err(_) => {
            // If normal strip_prefix fails (which can happen with different
            // path representations), try with canonical paths
            let canonical_base = base.canonicalize()
                .context("Failed to canonicalize base path")?;
            let canonical_path = path.canonicalize()
                .context("Failed to canonicalize file path")?;
            
            canonical_path.strip_prefix(canonical_base)
                .map(|p| p.to_path_buf())
                .map_err(|e| io::Error::new(io::ErrorKind::NotFound, e).into())
        }
    }
} 