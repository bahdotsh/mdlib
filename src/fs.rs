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
    pub tags: Vec<String>,
    pub category: Option<String>,
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
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_secs()));
            
            // Extract category from the path (relative to base dir)
            let category = get_category_from_path(dir, path);
            
            // Extract tags from file content
            let tags = extract_tags_from_file(path).unwrap_or_default();
            
            files.push(MarkdownFile {
                path: path.to_path_buf(),
                name: file_name.to_string(),
                modified,
                size: metadata.len(),
                tags,
                category,
            });
            continue;
        }
        
        // Check if it's a markdown file with .md extension
        if let Some(ext) = path.extension() {
            if ext == "md" {
                let metadata = fs::metadata(path).context("Failed to read file metadata")?;
                let modified = metadata.modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|d| d.as_secs()));
                
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled.md")
                    .to_string();
                
                // Extract category from the path (relative to base dir)
                let category = get_category_from_path(dir, path);
                
                // Extract tags from file content
                let tags = extract_tags_from_file(path).unwrap_or_default();
                
                files.push(MarkdownFile {
                    path: path.to_path_buf(),
                    name,
                    modified,
                    size: metadata.len(),
                    tags,
                    category,
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

// /// Checks if a path exists

// pub fn path_exists(path: &Path) -> bool {
//     path.exists()
// }

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

/// Extract tags from a markdown file
fn extract_tags_from_file(path: &Path) -> Result<Vec<String>> {
    let content = fs::read_to_string(path).context("Failed to read file for tags")?;
    extract_tags_from_content(&content)
}

/// Extract tags from a markdown content string
pub fn extract_tags_from_content(content: &str) -> Result<Vec<String>> {
    // Look for tags in the format #tag or tags: [tag1, tag2, tag3]
    let mut tags = Vec::new();
    
    // First check for a YAML frontmatter section with tags
    if let Some(frontmatter) = extract_frontmatter(content) {
        // Look for a tags: line in the frontmatter
        for line in frontmatter.lines() {
            let line = line.trim();
            if let Some(stripped) = line.strip_prefix("tags:") {
                // Parse the tags list
                let tags_part = stripped.trim();
                if tags_part.starts_with('[') && tags_part.ends_with(']') {
                    // Format: tags: [tag1, tag2, tag3]
                    let tags_list = &tags_part[1..tags_part.len()-1];
                    tags.extend(tags_list.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty()));
                } else {
                    // Format: tags: tag1 tag2 tag3
                    tags.extend(tags_part.split_whitespace()
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty()));
                }
            }
        }
    }
    
    // Then scan for hashtags in the content
    for word in content.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            // Extract just the tag part (without #)
            let tag = word[1..].trim_end_matches(|c: char| !c.is_alphanumeric()).to_string();
            if !tag.is_empty() && !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }
    
    Ok(tags)
}

/// Extract YAML frontmatter from markdown content if present
fn extract_frontmatter(content: &str) -> Option<String> {
    let trimmed = content.trim_start();
    if let Some(stripped) = trimmed.strip_prefix("---") {
        if let Some(end_index) = stripped.find("---") {
            return Some(stripped[..end_index].trim().to_string());
        }
    }
    None
}

/// Get the category from a file path (relative to base directory)
fn get_category_from_path(base_dir: &Path, file_path: &Path) -> Option<String> {
    if let Ok(rel_path) = file_path.strip_prefix(base_dir) {
        let parent = rel_path.parent()?;
        if parent.as_os_str().is_empty() {
            return None; // File is directly in the base directory
        }
        return Some(parent.to_string_lossy().into_owned());
    }
    None
}

/// Creates a new category directory
pub fn create_category(dir: &Path, category_name: &str) -> Result<PathBuf> {
    let path = dir.join(category_name);
    
    // Log that we're creating the category
    println!("Creating category directory at: {:?}", path);
    
    // Create the directory if it doesn't exist
    if !path.exists() {
        fs::create_dir_all(&path).context("Failed to create category directory")?;
        println!("Category directory created successfully");
    } else {
        println!("Category directory already exists");
    }
    
    Ok(path)
}

/// Add tags to a markdown file
pub fn add_tags_to_file(path: &Path, tags: &[String]) -> Result<()> {
    let content = fs::read_to_string(path).context("Failed to read file")?;
    let new_content = add_tags_to_content(&content, tags)?;
    fs::write(path, new_content).context("Failed to write file")
}

/// Add tags to markdown content
pub fn add_tags_to_content(content: &str, tags: &[String]) -> Result<String> {
    if tags.is_empty() {
        return Ok(content.to_string());
    }
    
    let mut existing_tags = extract_tags_from_content(content)?;
    let mut added_any = false;
    
    // Add new tags if they don't already exist
    for tag in tags {
        if !existing_tags.contains(tag) {
            existing_tags.push(tag.clone());
            added_any = true;
        }
    }
    
    if !added_any {
        // No new tags to add
        return Ok(content.to_string());
    }
    
    // Check if there's frontmatter
    if let Some(frontmatter) = extract_frontmatter(content) {
        // Update the frontmatter with the new tags
        let mut updated_frontmatter = String::new();
        let mut has_tags_line = false;
        
        for line in frontmatter.lines() {
            if line.trim().starts_with("tags:") {
                // Replace the tags line
                updated_frontmatter.push_str(&format!("tags: [{}]\n", existing_tags.join(", ")));
                has_tags_line = true;
            } else {
                updated_frontmatter.push_str(line);
                updated_frontmatter.push('\n');
            }
        }
        
        if !has_tags_line {
            // Add a new tags line
            updated_frontmatter.push_str(&format!("tags: [{}]\n", existing_tags.join(", ")));
        }
        
        // Replace the frontmatter in the content
        let start_idx = content.find("---").unwrap_or(0);
        let end_idx = content[start_idx + 3..].find("---").map(|i| start_idx + i + 6).unwrap_or(start_idx);
        let mut new_content = String::new();
        new_content.push_str("---\n");
        new_content.push_str(&updated_frontmatter);
        new_content.push_str("---\n");
        new_content.push_str(&content[end_idx..]);
        
        Ok(new_content)
    } else {
        // No frontmatter, add one
        let mut new_content = String::new();
        new_content.push_str("---\n");
        new_content.push_str(&format!("tags: [{}]\n", existing_tags.join(", ")));
        new_content.push_str("---\n\n");
        new_content.push_str(content);
        
        Ok(new_content)
    }
} 