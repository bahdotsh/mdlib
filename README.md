---
tags: [test]
---

# mdlib - Markdown Note-Taking Application

A beautiful, web-based tool for creating, editing, and organizing markdown notes with real-time preview.

## Features

- 📝 Browse and edit markdown files in a directory
- ✨ Create new markdown files
- 👁️ Preview markdown rendering in real-time
- 🔍 Search across all your notes
- 🌙 Dark mode support
- ⚡ Keyboard shortcuts for quick actions
- 🔄 Auto-save functionality
- 💾 Simple file management
- 📱 Responsive design for all device sizes

## Getting Started

### Prerequisites

- Rust and Cargo (1.54.0 or newer)

### Installation

1. Clone the repository (or download the source code):

```bash
git clone https://github.com/yourusername/mdlib.git
cd mdlib
```

2. Build the project:

```bash
cargo build --release
```

The compiled binary will be located in `target/release/mdlib`.

### Usage

To start mdlib, run:

```bash
mdlib [DIRECTORY]
```

Where `[DIRECTORY]` is the path to the directory containing your markdown files. If not specified, the current directory is used.

Once started, open your browser and navigate to [http://localhost:3000](http://localhost:3000).

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Save current file
- `Ctrl/Cmd + B`: Bold selected text
- `Ctrl/Cmd + I`: Italicize selected text
- `Ctrl/Cmd + P`: Toggle preview mode
- `Ctrl/Cmd + N`: Create new note

## Development

### Project Structure

- `src/`: Source code
  - `main.rs`: Entry point
  - `fs.rs`: File system operations
  - `server.rs`: Web server and API endpoints
  - `config.rs`: Configuration management
- `static/`: Static web files
  - `index.html`: Main HTML page
  - `css/`: Stylesheets
  - `js/`: JavaScript files

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mdlib.git
cd mdlib

# Build the project
cargo build --release

# Run the application
./target/release/mdlib
```


## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 