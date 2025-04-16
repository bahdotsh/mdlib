use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use anyhow::{Result, Context};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// The port to run the server on
    pub port: u16,
    /// Whether to watch for file changes
    pub watch_files: bool,
    /// The address to bind to
    pub bind_address: String,
    /// The maximum file size in megabytes
    pub max_file_size_mb: u64,
    /// Enable dark mode by default
    pub default_dark_mode: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 3000,
            watch_files: true,
            bind_address: "127.0.0.1".to_string(),
            max_file_size_mb: 10,
            default_dark_mode: false,
        }
    }
}

impl AppConfig {
    /// Load configuration from a file or create default if it doesn't exist
    pub fn load_or_default(config_path: &PathBuf) -> Result<Self> {
        if config_path.exists() {
            let config_str = fs::read_to_string(config_path)
                .context(format!("Failed to read config file: {:?}", config_path))?;
            
            serde_json::from_str(&config_str)
                .context("Failed to parse config file")
        } else {
            let config = Self::default();
            
            // Create parent directory if it doesn't exist
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent)
                    .context(format!("Failed to create config directory: {:?}", parent))?;
            }
            
            // Write default config to file
            let config_str = serde_json::to_string_pretty(&config)
                .context("Failed to serialize config")?;
            
            fs::write(config_path, config_str)
                .context(format!("Failed to write config file: {:?}", config_path))?;
            
            Ok(config)
        }
    }
    
    // /// Save configuration to a file
    // pub fn save(&self, config_path: &PathBuf) -> Result<()> {
    //     let config_str = serde_json::to_string_pretty(self)
    //         .context("Failed to serialize config")?;
        
    //     fs::write(config_path, config_str)
    //         .context(format!("Failed to write config file: {:?}", config_path))
    // }
    
    /// Get the server address with port
    pub fn server_address(&self) -> String {
        format!("{}:{}", self.bind_address, self.port)
    }
} 