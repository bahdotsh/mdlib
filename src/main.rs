use std::path::PathBuf;
use std::env;

mod fs;
mod server;
mod config;

#[tokio::main]
async fn main() {
    // Print a welcome message
    println!("\n=======================================================");
    println!("🔍 mdlib - Your Personal Wiki / MD library!");
    println!("=======================================================");
    
    // Check for special commands
    let args: Vec<String> = env::args().collect();
    
    // Handle configuration commands
    if args.len() > 1 {
        if args[1] == "--config" || args[1] == "-c" {
            handle_config_command(&args);
            return;
        }
    }
    
    // Check for custom config file
    let mut custom_config_path = None;
    let mut notes_dir = None;
    let mut i = 1;
    
    while i < args.len() {
        if args[i] == "--config-file" || args[i] == "--conf" {
            if i + 1 < args.len() {
                custom_config_path = Some(PathBuf::from(&args[i + 1]));
                i += 2;
            } else {
                eprintln!("Error: Missing path after --config-file");
                std::process::exit(1);
            }
        } else {
            // Assume it's the notes directory
            notes_dir = Some(PathBuf::from(&args[i]));
            i += 1;
        }
    }
    
    // Get the current directory or from args
    let notes_dir = notes_dir.unwrap_or_else(|| 
        env::current_dir().expect("Failed to get current directory")
    );
    
    println!("📂 Starting mdlib server in directory: {:?}", notes_dir);
    
    // Start the web server
    let server = server::start_server(notes_dir, custom_config_path).await;
    
    // Run the server
    if let Err(err) = server {
        eprintln!("\n❌ Server error: {}", err);
        std::process::exit(1);
    }
}

fn handle_config_command(args: &[String]) {
    // Get config path
    let config_path = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mdlib/config.json");
    
    if args.len() == 2 {
        // Just --config with no other args - print the path and content if it exists
        println!("Config path: {:?}", config_path);
        if config_path.exists() {
            match std::fs::read_to_string(&config_path) {
                Ok(content) => {
                    println!("Current config:");
                    println!("{}", content);
                },
                Err(err) => {
                    println!("Error reading config file: {}", err);
                }
            }
        } else {
            println!("Config file does not exist yet.");
            println!("It will be created when you run mdlib for the first time.");
            println!("You can create it now with `mdlib --config create`");
        }
    } else if args.len() >= 3 {
        if args[2] == "create" {
            // Create a default config
            let default_config = config::AppConfig::default();
            if let Some(parent) = config_path.parent() {
                if let Err(err) = std::fs::create_dir_all(parent) {
                    println!("Error creating config directory: {}", err);
                    return;
                }
            }
            
            match serde_json::to_string_pretty(&default_config) {
                Ok(config_str) => {
                    match std::fs::write(&config_path, config_str) {
                        Ok(_) => {
                            println!("✅ Created default config at: {:?}", config_path);
                        },
                        Err(err) => {
                            println!("❌ Error writing config file: {}", err);
                        }
                    }
                },
                Err(err) => {
                    println!("Error serializing config: {}", err);
                }
            }
        } else {
            println!("Unknown config command: {}", args[2]);
            println!("Available commands:");
            println!("  mdlib --config        Show config path and current settings");
            println!("  mdlib --config create Create a default config file");
        }
    }
}
