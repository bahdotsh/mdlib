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
    const btnSave = document.getElementById('btn-save');
    const btnNewNote = document.getElementById('btn-new-note');
    const btnEmptyNewNote = document.getElementById('btn-empty-new-note');
    const btnEdit = document.getElementById('btn-edit');
    const btnSplitView = document.getElementById('btn-split-view');
    const btnPreviewOnly = document.getElementById('btn-preview-only');
    const newNoteModal = document.getElementById('new-note-modal');
    const newNoteName = document.getElementById('new-note-name');
    const btnModalCreate = document.getElementById('btn-modal-create');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const searchInput = document.getElementById('search-input');
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    const editorToolbar = document.getElementById('editor-toolbar');
    const toolbarButtons = document.querySelectorAll('[data-format]');
    const emptyState = document.getElementById('empty-state');
    const contentContainer = document.getElementById('content-container');
    const currentFilename = document.getElementById('current-filename');

    // State
    let currentFile = null;
    let isEditing = false;
    let viewMode = 'preview'; // 'preview', 'edit', or 'split'
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let autoSaveTimeout = null;
    
    // Initialize the application
    init();

    // Initialization
    function init() {
        // Ensure highlight.js is loaded
        if (typeof hljs === 'undefined') {
            console.error('highlight.js is not loaded. Syntax highlighting will not work.');
        }
        
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
                if (typeof hljs === 'undefined') {
                    return code; // Fallback if highlight.js isn't loaded
                }
                
                try {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                } catch (e) {
                    console.error('Error highlighting code:', e);
                    return code; // Return original code on error
                }
            }
        });
    }

    // Set up event listeners
    function setupEventListeners() {
        // New note buttons
        btnNewNote.addEventListener('click', showNewNoteModal);
        btnEmptyNewNote.addEventListener('click', showNewNoteModal);
        
        // Edit button - switch to edit mode
        btnEdit.addEventListener('click', () => setViewMode('edit'));
        
        // Split view button - show both editor and preview
        btnSplitView.addEventListener('click', () => setViewMode('split'));
        
        // Preview only button - switch back to preview mode
        btnPreviewOnly.addEventListener('click', () => setViewMode('preview'));
        
        // Save the current file
        btnSave.addEventListener('click', saveCurrentFile);
        
        // Create a new note from the modal
        btnModalCreate.addEventListener('click', createNewNote);
        
        // Cancel creating a new note
        btnModalCancel.addEventListener('click', hideNewNoteModal);
        
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
        
        // Escape key to exit modals
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !newNoteModal.classList.contains('hidden')) {
                hideNewNoteModal();
            }
        });
    }

    // Show new note modal
    function showNewNoteModal() {
        newNoteModal.classList.remove('hidden');
        newNoteName.focus();
    }
    
    // Hide new note modal
    function hideNewNoteModal() {
        newNoteModal.classList.add('hidden');
        newNoteName.value = '';
    }

    // Set the view mode (preview, edit, or split)
    function setViewMode(mode) {
        viewMode = mode;
        isEditing = mode === 'edit' || mode === 'split';
        
        // Update UI based on view mode
        if (mode === 'preview') {
            editorPane.classList.add('hidden');
            previewPane.classList.remove('hidden');
            editorToolbar.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnSplitView.classList.remove('hidden');
            btnPreviewOnly.classList.add('hidden');
            btnSave.classList.add('hidden');
            document.getElementById('content').classList.remove('split-view');
        } else if (mode === 'edit') {
            editorPane.classList.remove('hidden');
            previewPane.classList.add('hidden');
            editorToolbar.classList.remove('hidden');
            btnEdit.classList.add('hidden');
            btnSplitView.classList.remove('hidden');
            btnPreviewOnly.classList.remove('hidden');
            btnSave.classList.remove('hidden');
            document.getElementById('content').classList.remove('split-view');
        } else if (mode === 'split') {
            editorPane.classList.remove('hidden');
            previewPane.classList.remove('hidden');
            editorToolbar.classList.remove('hidden');
            btnEdit.classList.remove('hidden');
            btnSplitView.classList.add('hidden');
            btnPreviewOnly.classList.remove('hidden');
            btnSave.classList.remove('hidden');
            document.getElementById('content').classList.add('split-view');
            updatePreview();
        }
    }

    // Load all markdown files
    function loadFiles() {
        fileList.innerHTML = `
            <li class="loading text-gray-500 text-sm italic flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading notes...
            </li>
        `;
        
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
                    
                    // Display the filename
                    currentFilename.textContent = currentFile;
                    
                    // Update active file in the list
                    const fileItems = fileList.querySelectorAll('li');
                    fileItems.forEach(item => {
                        item.classList.remove('active');
                        if (item.getAttribute('data-path') === path) {
                            item.classList.add('active');
                        }
                    });
                    
                    // Show content container, hide empty state
                    emptyState.classList.add('hidden');
                    contentContainer.classList.remove('hidden');
                    
                    // Set to preview mode initially
                    setViewMode('preview');
                    
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
        
        try {
            // Sanitize HTML to prevent XSS
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(editor.value));
            preview.innerHTML = sanitizedHtml;
            
            // Apply syntax highlighting to code blocks
            if (typeof hljs !== 'undefined') {
                preview.querySelectorAll('pre code').forEach(block => {
                    hljs.highlightElement(block);
                });
            }
        } catch (error) {
            console.error('Error rendering markdown:', error);
            preview.innerHTML = `<div class="text-red-500">Error rendering markdown: ${error.message}</div>`;
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
                // Show success message
                const saveBtn = document.getElementById('btn-save');
                const originalText = saveBtn.innerHTML;
                
                saveBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                `;
                
                setTimeout(() => {
                    saveBtn.innerHTML = originalText;
                }, 2000);
                
                // Update preview
                updatePreview();
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
            if (currentFile && isEditing) {
                saveCurrentFile();
            }
        }, 5000); // Auto-save after 5 seconds of inactivity
    }

    // Create a new note
    function createNewNote() {
        const name = newNoteName.value.trim();
        
        if (!name) {
            alert('Please enter a name for the new note.');
            return;
        }
        
        // Add .md extension if not present
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        
        fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fileName,
                content: '# ' + name + '\n\nStart writing your markdown here...'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Close the modal
                hideNewNoteModal();
                
                // Refresh file list
                loadFiles();
                
                // Load the new file
                setTimeout(() => {
                    loadFile(data.data);
                    
                    // Switch to edit mode for new files
                    setViewMode('split');
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

    // Search files
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
                    fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error searching files</li>';
                    console.error('Error searching files:', data.message);
                }
            })
            .catch(error => {
                fileList.innerHTML = '<li class="text-red-500 text-sm italic">Error searching files</li>';
                console.error('Error searching files:', error);
            });
    }

    // Apply formatting to the editor
    function applyFormat(format) {
        if (!isEditing) return;
        
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        let replacement = '';
        
        switch (format) {
            case 'bold':
                replacement = `**${selectedText}**`;
                break;
            case 'italic':
                replacement = `*${selectedText}*`;
                break;
            case 'heading':
                replacement = `# ${selectedText}`;
                break;
            case 'link':
                replacement = `[${selectedText}](url)`;
                break;
            case 'image':
                replacement = `![${selectedText}](image-url)`;
                break;
            case 'list':
                replacement = selectedText
                    .split('\n')
                    .map(line => line.trim() ? `- ${line}` : line)
                    .join('\n');
                break;
            case 'code':
                replacement = selectedText.includes('\n')
                    ? '```\n' + selectedText + '\n```'
                    : '`' + selectedText + '`';
                break;
        }
        
        editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
        editor.focus();
        
        // Update preview
        updatePreview();
        
        // Schedule auto-save
        scheduleAutoSave();
    }

    // Handle keyboard shortcuts
    function handleKeyboardShortcuts(e) {
        // Only process if we're in edit mode
        if (!isEditing) return;
        
        // Cmd/Ctrl + S to save
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
        
        // Process other shortcuts only if we have a file open and the editor is focused
        if (currentFile && document.activeElement === editor) {
            // Cmd/Ctrl + B for bold
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                applyFormat('bold');
            }
            
            // Cmd/Ctrl + I for italic
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                e.preventDefault();
                applyFormat('italic');
            }
            
            // Cmd/Ctrl + K for link
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                applyFormat('link');
            }
        }
    }

    // Extract filename from path
    function getFilename(path) {
        return path.split('/').pop();
    }

    // Debounce function to limit how often a function is called
    function debounce(func, delay) {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            const timeout = setTimeout(later, delay);
        };
    }
}); 