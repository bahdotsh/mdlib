use std::path::PathBuf;
use std::env;

mod fs;
mod server;
mod config;

#[tokio::main]
async fn main() {
    // Get the current directory or from args
    let notes_dir = env::args().nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| env::current_dir().expect("Failed to get current directory"));
    
    println!("Starting mdlib server in directory: {:?}", notes_dir);
    
    // Start the web server
    let server = server::start_server(notes_dir).await;
    
    // Run the server
    if let Err(err) = server {
        eprintln!("Server error: {}", err);
        std::process::exit(1);
    }
}
