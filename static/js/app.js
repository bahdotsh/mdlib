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
    const btnAddTags = document.getElementById('btn-add-tags');
    const newNoteModal = document.getElementById('new-note-modal');
    const newNoteName = document.getElementById('new-note-name');
    const newNoteCategory = document.getElementById('new-note-category');
    const newNoteTags = document.getElementById('new-note-tags');
    const btnModalCreate = document.getElementById('btn-modal-create');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const searchInput = document.getElementById('search-input');
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    const editorToolbar = document.getElementById('editor-toolbar');
    const toolbarButtons = document.querySelectorAll('[data-format]');
    const emptyState = document.getElementById('empty-state');
    const contentContainer = document.getElementById('content-container');
    const currentFilename = document.getElementById('current-filename');
    const addTagsModal = document.getElementById('add-tags-modal');
    const tagInput = document.getElementById('tag-input');
    const btnTagAdd = document.getElementById('btn-tag-add');
    const btnTagCancel = document.getElementById('btn-tag-cancel');
    const categoryList = document.getElementById('category-list');
    const tagsContainer = document.getElementById('tags-container');
    const newCategoryInput = document.getElementById('new-category-input');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const newCategoryBtn = document.getElementById('new-category-btn');
    const categoryForm = document.getElementById('category-form');

    // State
    let currentFile = null;
    let isEditing = false;
    let viewMode = 'preview'; // 'preview', 'edit', or 'split'
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let autoSaveTimeout = null;
    let allTags = new Set();
    let categories = [];
    
    // Initialize the application
    init();

    // Initialization
    function init() {
        // Configure highlight.js
        if (typeof hljs !== 'undefined') {
            // Register commonly used languages if we're using the full bundle
            hljs.highlightAll();
            console.log('highlight.js loaded successfully');
        } else {
            console.error('highlight.js is not loaded. Syntax highlighting will not work.');
        }
        
        // Load files
        loadFiles();
        
        // Load categories
        loadCategories();
        
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
                        return hljs.highlight(lang, code).value;
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
        
        // Add tags button in toolbar
        btnAddTags.addEventListener('click', () => {
            if (currentFile) {
                showAddTagsModal(currentFile);
            } else {
                alert('No file is currently open.');
            }
        });
        
        // Save the current file
        btnSave.addEventListener('click', saveCurrentFile);
        
        // Create a new note from the modal
        btnModalCreate.addEventListener('click', createNewNote);
        
        // Cancel creating a new note
        btnModalCancel.addEventListener('click', hideNewNoteModal);
        
        // Add tag buttons
        btnTagAdd.addEventListener('click', addTagsToCurrentFile);
        btnTagCancel.addEventListener('click', hideAddTagsModal);
        
        // Show category form
        newCategoryBtn.addEventListener('click', toggleCategoryForm);
        
        // Add category button
        addCategoryBtn.addEventListener('click', createCategory);
        
        // Add category on enter key
        newCategoryInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                createCategory();
            }
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
        
        // Escape key to exit modals
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (!newNoteModal.classList.contains('hidden')) {
                    hideNewNoteModal();
                }
                if (!addTagsModal.classList.contains('hidden')) {
                    hideAddTagsModal();
                }
                if (!categoryForm.classList.contains('hidden')) {
                    hideCategoryForm();
                }
            }
        });
    }

    // Show new note modal
    function showNewNoteModal() {
        // Load categories first to ensure dropdown is populated
        loadCategories();
        
        newNoteModal.classList.remove('hidden');
        newNoteName.focus();
    }
    
    // Hide new note modal
    function hideNewNoteModal() {
        newNoteModal.classList.add('hidden');
        newNoteName.value = '';
        newNoteCategory.value = '';
        newNoteTags.value = '';
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
            setTimeout(() => editor.focus(), 0);
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
            setTimeout(() => editor.focus(), 0);
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
        
        // Collect all tags
        allTags = new Set();
        
        files.forEach(file => {
            const li = document.createElement('li');
            li.className = 'py-1 px-2 rounded hover:bg-gray-100 cursor-pointer flex items-center justify-between';
            
            // Create filename container
            const filenameContainer = document.createElement('span');
            filenameContainer.textContent = file.name;
            filenameContainer.className = 'truncate';
            li.appendChild(filenameContainer);
            
            // Create actions container
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity';
            
            // Add tags button
            const tagButton = document.createElement('button');
            tagButton.className = 'text-gray-500 hover:text-indigo-600 p-1 rounded';
            tagButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
            `;
            tagButton.title = 'Add Tags';
            tagButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showAddTagsModal(file.path);
            });
            
            // Add delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'text-gray-500 hover:text-red-600 p-1 rounded';
            deleteButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            `;
            deleteButton.title = 'Delete Note';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFile(file.path);
            });
            
            actionsContainer.appendChild(tagButton);
            actionsContainer.appendChild(deleteButton);
            li.appendChild(actionsContainer);
            
            // Add hover effect
            li.addEventListener('mouseenter', () => {
                actionsContainer.classList.remove('opacity-0');
                actionsContainer.classList.add('opacity-100');
            });
            
            li.addEventListener('mouseleave', () => {
                actionsContainer.classList.remove('opacity-100');
                actionsContainer.classList.add('opacity-0');
            });
            
            // Set data attributes
            li.setAttribute('data-path', file.path);
            
            // Add click handler for the whole item
            li.addEventListener('click', () => loadFile(file.path));
            
            // Add tags display if file has tags
            if (file.tags && file.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'flex flex-wrap gap-1 mt-1';
                
                file.tags.forEach(tag => {
                    allTags.add(tag);
                    
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded group relative';
                    
                    // Create tag text wrapper
                    const tagText = document.createElement('span');
                    tagText.textContent = tag;
                    tagSpan.appendChild(tagText);
                    
                    // Create delete button for tag
                    const tagDeleteBtn = document.createElement('button');
                    tagDeleteBtn.className = 'ml-1 text-indigo-400 hover:text-red-500 hidden group-hover:inline-block';
                    tagDeleteBtn.innerHTML = '×';
                    tagDeleteBtn.title = 'Remove tag';
                    tagDeleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeTagFromFile(file.path, tag);
                    });
                    tagSpan.appendChild(tagDeleteBtn);
                    
                    tagsContainer.appendChild(tagSpan);
                });
                
                li.appendChild(tagsContainer);
            }
            
            // Add category if file has a category
            if (file.category) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'text-xs text-gray-500 mt-1';
                categoryDiv.innerHTML = `<span class="inline-block mr-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </span>${file.category}`;
                li.appendChild(categoryDiv);
            }
            
            fileList.appendChild(li);
        });
        
        // Update tags display
        updateTagsDisplay();
    }

    // Load a file into the editor
    function loadFile(path) {
        // Need to use the full path for files in categories
        fetch(`/api/files/${encodeURIComponent(path)}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Update the editor and preview
                    editor.value = data.data;
                    updatePreview();
                    
                    // Store the full path for saving
                    currentFile = path;
                    
                    // Display just the filename in the UI
                    currentFilename.textContent = getFilename(path);
                    
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
                    document.title = `${getFilename(path)} - mdlib Personal Wiki`;
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
                    hljs.highlightBlock(block);
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
        
        // Use the full path stored in currentFile
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
        
        // Get category and tags
        const category = newNoteCategory.value.trim();
        const tagsInput = newNoteTags.value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        // Generate frontmatter if we have category or tags
        let frontmatter = '';
        if (category || tags.length > 0) {
            frontmatter = '---\n';
            if (category) {
                frontmatter += `category: ${category}\n`;
            }
            if (tags.length > 0) {
                frontmatter += `tags: [${tags.join(', ')}]\n`;
            }
            frontmatter += '---\n\n';
        }
        
        // Create content with frontmatter
        const content = frontmatter + '# ' + name + '\n\nStart writing your markdown here...';
        
        // Create the file
        fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fileName,
                content: content
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
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            
            clearTimeout(timeout);
            timeout = setTimeout(later, delay);
        };
    }

    // Show add tags modal
    function showAddTagsModal(filePath) {
        tagInput.value = '';
        addTagsModal.setAttribute('data-file', filePath || currentFile);
        addTagsModal.classList.remove('hidden');
        tagInput.focus();
    }
    
    // Hide add tags modal
    function hideAddTagsModal() {
        addTagsModal.classList.add('hidden');
        tagInput.value = '';
    }
    
    // Add tags to current file
    function addTagsToCurrentFile() {
        const filePath = addTagsModal.getAttribute('data-file');
        if (!filePath) {
            alert('No file selected.');
            return;
        }
        
        const tagsInput = tagInput.value.trim();
        if (!tagsInput) {
            alert('Please enter at least one tag.');
            return;
        }
        
        const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        // Use the full file path
        fetch(`/api/tags/${encodeURIComponent(filePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Close the modal
                hideAddTagsModal();
                
                // Refresh file list to show updated tags
                loadFiles();
                
                // If this was the current file, reload it to show updated content
                if (filePath === currentFile) {
                    loadFile(filePath);
                }
            } else {
                console.error('Error adding tags:', data.message);
                alert(`Error adding tags: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error adding tags:', error);
            alert('Error adding tags. Please try again.');
        });
    }
    
    // Load categories
    function loadCategories() {
        fetch('/api/categories')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    categories = data.data;
                    updateCategoriesDisplay();
                } else {
                    categoryList.innerHTML = '<li class="text-red-500 text-sm italic">Error loading categories</li>';
                    console.error('Error loading categories:', data.message);
                }
            })
            .catch(error => {
                categoryList.innerHTML = '<li class="text-red-500 text-sm italic">Error loading categories</li>';
                console.error('Error loading categories:', error);
            });
    }
    
    // Update categories display
    function updateCategoriesDisplay() {
        if (categories.length === 0) {
            categoryList.innerHTML = '<li class="category-empty">No categories found</li>';
            return;
        }
        
        categoryList.innerHTML = '';
        
        // Add "All" option
        const allItem = document.createElement('li');
        allItem.textContent = 'All Notes';
        allItem.className = 'category-item active';
        allItem.addEventListener('click', () => {
            loadFiles();
            // Update active state
            categoryList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            allItem.classList.add('active');
        });
        categoryList.appendChild(allItem);
        
        // Add each category
        categories.forEach(category => {
            const li = document.createElement('li');
            li.className = 'category-item flex justify-between items-center';
            
            // Category name and icon
            const categoryLabel = document.createElement('span');
            categoryLabel.className = 'flex-grow flex items-center';
            categoryLabel.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="category-name">${category}</span>
            `;
            li.appendChild(categoryLabel);
            
            // Delete category button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'category-delete-btn text-gray-400 hover:text-red-500 hidden group-hover:block';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            `;
            deleteBtn.title = 'Delete category';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCategory(category);
            });
            li.appendChild(deleteBtn);
            
            // Show delete button on hover
            li.addEventListener('mouseenter', () => {
                deleteBtn.classList.remove('hidden');
            });
            li.addEventListener('mouseleave', () => {
                deleteBtn.classList.add('hidden');
            });
            
            // Filter by category when clicked
            li.addEventListener('click', () => {
                searchByCategory(category);
                // Update active state
                categoryList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                li.classList.add('active');
            });
            
            categoryList.appendChild(li);
        });
        
        // Update category dropdown in new note modal
        newNoteCategory.innerHTML = '<option value="">No Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            newNoteCategory.appendChild(option);
        });
    }
    
    // Create a new category
    function createCategory() {
        const name = newCategoryInput.value.trim();
        
        if (!name) {
            alert('Please enter a category name.');
            return;
        }
        
        fetch('/api/category', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Clear input and hide form
                newCategoryInput.value = '';
                hideCategoryForm();
                
                // Show success message
                const successMessage = document.createElement('div');
                successMessage.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md';
                successMessage.innerHTML = `<p>Category "${name}" created successfully!</p>`;
                document.body.appendChild(successMessage);
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successMessage.remove();
                }, 3000);
                
                // Reload categories
                loadCategories();
            } else {
                console.error('Error creating category:', data.message);
                alert(`Error creating category: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error creating category:', error);
            alert('Error creating category. Please try again.');
        });
    }
    
    // Update tags display
    function updateTagsDisplay() {
        if (allTags.size === 0) {
            tagsContainer.innerHTML = '<span class="text-gray-500 text-sm italic">No tags found</span>';
            return;
        }
        
        tagsContainer.innerHTML = '';
        
        // Add each tag
        Array.from(allTags).sort().forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'text-xs bg-indigo-100 text-indigo-800 rounded px-2 py-1 cursor-pointer hover:bg-indigo-200 flex items-center gap-1';
            
            // Tag text
            const tagText = document.createElement('span');
            tagText.textContent = tag;
            tagSpan.appendChild(tagText);
            
            tagSpan.addEventListener('click', () => {
                searchByTag(tag);
            });
            
            tagsContainer.appendChild(tagSpan);
        });
    }
    
    // Search by category
    function searchByCategory(category) {
        fetch(`/api/search?category=${encodeURIComponent(category)}`)
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
    
    // Search by tag
    function searchByTag(tag) {
        fetch(`/api/search?tag=${encodeURIComponent(tag)}`)
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

    // Toggle category form visibility
    function toggleCategoryForm() {
        if (categoryForm.classList.contains('hidden')) {
            showCategoryForm();
        } else {
            hideCategoryForm();
        }
    }
    
    // Show category form
    function showCategoryForm() {
        categoryForm.classList.remove('hidden');
        newCategoryInput.focus();
    }
    
    // Hide category form
    function hideCategoryForm() {
        categoryForm.classList.add('hidden');
        newCategoryInput.value = '';
    }

    // Delete a file
    function deleteFile(path) {
        if (!confirm(`Are you sure you want to delete this note?`)) {
            return;
        }
        
        fetch(`/api/files/${encodeURIComponent(path)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // If the current file is the one being deleted, clear the editor
                if (currentFile === path) {
                    currentFile = null;
                    editor.value = '';
                    preview.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    contentContainer.classList.add('hidden');
                    document.title = 'mdlib Personal Wiki';
                }
                
                // Refresh the file list
                loadFiles();
                
                // Show success message
                showToast('Note deleted successfully', 'success');
            } else {
                console.error('Error deleting file:', data.message);
                showToast(`Error deleting note: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            showToast('Error deleting note. Please try again.', 'error');
        });
    }

    // Remove a tag from a file
    function removeTagFromFile(filePath, tag) {
        fetch(`/api/tags/${encodeURIComponent(filePath)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: [tag] })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Refresh the file if it's currently open
                if (currentFile === filePath) {
                    loadFile(filePath);
                }
                
                // Refresh the file list
                loadFiles();
                
                // Show success message
                showToast(`Tag "${tag}" removed successfully`, 'success');
            } else {
                console.error('Error removing tag:', data.message);
                showToast(`Error removing tag: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error removing tag:', error);
            showToast('Error removing tag. Please try again.', 'error');
        });
    }

    // Delete a category
    function deleteCategory(category) {
        if (!confirm(`Are you sure you want to delete the category "${category}"?`)) {
            return;
        }
        
        fetch(`/api/category/${encodeURIComponent(category)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Refresh categories
                loadCategories();
                // Refresh files
                loadFiles();
                
                // Show success message
                showToast(`Category "${category}" deleted successfully`, 'success');
            } else {
                console.error('Error deleting category:', data.message);
                showToast(`Error: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting category:', error);
            showToast('Error deleting category. Please try again.', 'error');
        });
    }

    // Show a toast message
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 right-5 p-3 rounded-lg shadow-lg transition-opacity duration-500 z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Fade in
        setTimeout(() => {
            toast.classList.add('opacity-0');
            
            // Remove after fade out
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 3000);
    }
}); 