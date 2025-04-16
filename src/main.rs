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
    
    // Get the current directory or from args
    let notes_dir = env::args().nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().expect("Failed to get current directory"));
    
    println!("📂 Starting mdlib server in directory: {:?}", notes_dir);
    
    // Start the web server
    let server = server::start_server(notes_dir).await;
    
    // Run the server
    if let Err(err) = server {
        eprintln!("\n❌ Server error: {}", err);
        std::process::exit(1);
    }
}
