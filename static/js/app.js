/**
 * mdlib - Markdown Note-Taking Application
 * Client-side functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileList = document.getElementById('file-list');
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    const btnSave = document.getElementById('btn-save');
    const btnNewNote = document.getElementById('btn-new-note');
    const newNoteModal = document.getElementById('new-note-modal');
    const newNoteName = document.getElementById('new-note-name');
    const btnModalCreate = document.getElementById('btn-modal-create');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const searchInput = document.getElementById('search-input');
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    const editorToolbar = document.getElementById('editor-toolbar');
    const toolbarButtons = document.querySelectorAll('[data-format]');

    // State
    let currentFile = null;
    let isEditing = true;
    let isPreviewVisible = false;
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let autoSaveTimeout = null;
    
    // Initialize the application
    init();

    // Initialization
    function init() {
        // Load files
        loadFiles();
        
        // Set up event listeners
        setupEventListeners();
        
        // Apply dark mode if needed
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Configure marked renderer
        configureMarked();
    }

    // Configure marked for rendering markdown
    function configureMarked() {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            highlight: function(code, lang) {
                if (hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            }
        });
    }

    // Set up event listeners
    function setupEventListeners() {
        // Toggle between edit and preview modes
        btnToggleMode.addEventListener('click', togglePreviewMode);
        
        // Save the current file
        btnSave.addEventListener('click', saveCurrentFile);
        
        // Show modal for creating a new note
        btnNewNote.addEventListener('click', () => {
            newNoteModal.classList.remove('hidden');
            newNoteName.focus();
        });
        
        // Create a new note from the modal
        btnModalCreate.addEventListener('click', createNewNote);
        
        // Cancel creating a new note
        btnModalCancel.addEventListener('click', () => {
            newNoteModal.classList.add('hidden');
            newNoteName.value = '';
        });
        
        // Search functionality
        searchInput.addEventListener('input', debounce(searchFiles, 300));
        
        // Toggle dark mode
        toggleDarkMode.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            document.body.classList.toggle('dark-mode', isDarkMode);
            localStorage.setItem('darkMode', isDarkMode);
        });
        
        // Auto-preview as you type
        editor.addEventListener('input', () => {
            updatePreview();
            scheduleAutoSave();
        });
        
        // Format text using toolbar buttons
        toolbarButtons.forEach(button => {
            button.addEventListener('click', () => {
                const format = button.getAttribute('data-format');
                applyFormat(format);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Enter key in new note name input
        newNoteName.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                createNewNote();
            }
        });
    }

    // Load all markdown files
    function loadFiles() {
        fileList.innerHTML = '<li class="loading text-gray-500 text-sm italic">Loading files...</li>';
        
        fetch('/api/files')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    displayFiles(data.data);
                } else {
                    fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error loading files</li>';
                    console.error('Error loading files:', data.message);
                }
            })
            .catch(error => {
                fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error loading files</li>';
                console.error('Error loading files:', error);
            });
    }

    // Display files in the sidebar
    function displayFiles(files) {
        if (files.length === 0) {
            fileList.innerHTML = '<li class="text-gray-500 text-sm italic">No markdown files found</li>';
            return;
        }
        
        fileList.innerHTML = '';
        
        files.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file.name;
            li.setAttribute('data-path', file.path);
            li.addEventListener('click', () => loadFile(file.path));
            fileList.appendChild(li);
        });
    }

    // Load a file into the editor
    function loadFile(path) {
        fetch(`/api/files/${encodeURIComponent(getFilename(path))}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Update the editor and preview
                    editor.value = data.data;
                    updatePreview();
                    
                    // Update current file
                    currentFile = getFilename(path);
                    
                    // Update active file in the list
                    const fileItems = fileList.querySelectorAll('li');
                    fileItems.forEach(item => {
                        item.classList.remove('active');
                        if (item.getAttribute('data-path') === path) {
                            item.classList.add('active');
                        }
                    });
                    
                    // Show the editor toolbar when a file is loaded
                    editorToolbar.classList.remove('hidden');
                    
                    // Add file name to document title
                    document.title = `${currentFile} - mdlib`;
                } else {
                    console.error('Error loading file:', data.message);
                    alert(`Error loading file: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Error loading file:', error);
                alert('Error loading file. Please try again.');
            });
    }

    // Update the preview with the current editor content
    function updatePreview() {
        if (!editor.value) {
            preview.innerHTML = '<div class="text-gray-400 italic">Nothing to preview</div>';
            return;
        }
        
        // Sanitize HTML to prevent XSS
        const sanitizedHtml = DOMPurify.sanitize(marked.parse(editor.value));
        preview.innerHTML = sanitizedHtml;
        
        // Apply syntax highlighting to code blocks
        preview.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }

    // Toggle between edit and preview modes
    function togglePreviewMode() {
        isPreviewVisible = !isPreviewVisible;
        
        if (isPreviewVisible) {
            editorPane.classList.remove('hidden');
            previewPane.classList.remove('hidden');
            btnToggleMode.textContent = 'Edit Mode';
            updatePreview();
        } else {
            editorPane.classList.remove('hidden');
            previewPane.classList.add('hidden');
            btnToggleMode.textContent = 'Preview Mode';
        }
    }

    // Save the current file
    function saveCurrentFile() {
        if (!currentFile) {
            alert('No file is currently open.');
            return;
        }
        
        const content = editor.value;
        
        fetch(`/api/files/${encodeURIComponent(currentFile)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Show a save confirmation
                const saveBtn = btnSave;
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saved!';
                saveBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
                saveBtn.classList.add('bg-green-700');
                
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.classList.add('bg-green-500', 'hover:bg-green-600');
                    saveBtn.classList.remove('bg-green-700');
                }, 1500);
            } else {
                console.error('Error saving file:', data.message);
                alert(`Error saving file: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error saving file:', error);
            alert('Error saving file. Please try again.');
        });
    }

    // Schedule auto-save
    function scheduleAutoSave() {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        
        autoSaveTimeout = setTimeout(() => {
            if (currentFile) {
                saveCurrentFile();
            }
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    // Create a new note
    function createNewNote() {
        const name = newNoteName.value.trim();
        
        if (!name) {
            alert('Please enter a name for the new note.');
            return;
        }
        
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const content = '# ' + name + '\n\n';
        
        fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: fileName, content })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Close modal and clear input
                newNoteModal.classList.add('hidden');
                newNoteName.value = '';
                
                // Reload file list and load the new file
                loadFiles();
                
                // Set a timeout to allow the file list to update, then load the new file
                setTimeout(() => {
                    loadFile(data.data);
                }, 300);
            } else {
                console.error('Error creating file:', data.message);
                alert(`Error creating file: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error creating file:', error);
            alert('Error creating file. Please try again.');
        });
    }

    // Search for files
    function searchFiles() {
        const query = searchInput.value.trim();
        
        if (!query) {
            loadFiles();
            return;
        }
        
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    displayFiles(data.data);
                } else {
                    console.error('Error searching files:', data.message);
                    fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error searching files</li>';
                }
            })
            .catch(error => {
                console.error('Error searching files:', error);
                fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error searching files</li>';
            });
    }

    // Apply formatting to selected text in the editor
    function applyFormat(format) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        let formattedText = '';
        
        switch (format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'heading':
                formattedText = `## ${selectedText}`;
                break;
            case 'link':
                formattedText = `[${selectedText}](url)`;
                break;
            case 'image':
                formattedText = `![${selectedText}](image_url)`;
                break;
            case 'list':
                formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
                break;
            case 'code':
                formattedText = '```\n' + selectedText + '\n```';
                break;
            default:
                formattedText = selectedText;
        }
        
        editor.focus();
        document.execCommand('insertText', false, formattedText);
        updatePreview();
        scheduleAutoSave();
    }

    // Handle keyboard shortcuts
    function handleKeyboardShortcuts(e) {
        // Check if Ctrl/Cmd key is pressed
        const isCtrlCmd = e.ctrlKey || e.metaKey;
        
        if (isCtrlCmd) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    saveCurrentFile();
                    break;
                case 'b':
                    e.preventDefault();
                    applyFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    applyFormat('italic');
                    break;
                case 'p':
                    e.preventDefault();
                    togglePreviewMode();
                    break;
                case 'n':
                    e.preventDefault();
                    btnNewNote.click();
                    break;
            }
        }
    }

    // Helper: Get filename from path
    function getFilename(path) {
        const parts = path.split('/');
        return parts[parts.length - 1];
    }

    // Helper: Debounce function for search
    function debounce(func, delay) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }
}); 