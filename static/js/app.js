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
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    // State
    let currentFile = null;
    let isEditing = false;
    let viewMode = 'preview'; // 'preview', 'edit', or 'split'
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let autoSaveTimeout = null;
    let allTags = new Set();
    let categories = [];
    let isMobile = window.innerWidth < 768;
    
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
        
        // Load tags
        updateTagsDisplay();
        
        // Set up event listeners
        setupEventListeners();
        
        // Apply dark mode if needed
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Configure marked renderer
        configureMarked();
        
        // Check screen size and set up responsive behavior
        checkScreenSize();
        window.addEventListener('resize', debounce(checkScreenSize, 100));
        
        // Create toast container
        createToastContainer();
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
                showToast('No file is currently open.', 'error');
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
        
        // Handle clicks on links in the preview pane (wiki-linking)
        preview.addEventListener('click', e => {
            // Check if the clicked element is a link
            if (e.target.tagName === 'A') {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                
                // Only handle .md links or links without extension (assumed to be markdown)
                if (href && (href.endsWith('.md') || !href.includes('.'))) {
                    // Remove leading slash if present for consistency
                    const cleanHref = href.startsWith('/') ? href.substring(1) : href;
                    console.log('Loading markdown link:', cleanHref);
                    loadFile(cleanHref);
                } else {
                    // For external links, open in a new tab
                    window.open(href, '_blank');
                }
            }
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
            }
        });
        
        // Sidebar toggle for mobile
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        
        // Close sidebar when clicking on the content area in mobile view
        document.addEventListener('click', (e) => {
            if (isMobile && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                e.target !== sidebarToggle) {
                toggleSidebar();
            }
        });
    }

    // Check screen size and set up responsive behavior
    function checkScreenSize() {
        isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            sidebarToggle.classList.remove('hidden');
        } else {
            sidebarToggle.classList.add('hidden');
            sidebar.classList.remove('active');
        }
    }
    
    // Toggle sidebar for mobile view
    function toggleSidebar() {
        sidebar.classList.toggle('active');
    }
    
    // Create toast container
    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
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
                    // Update tags display after loading files
                    updateTagsDisplay();
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

    // Display files in the file list
    function displayFiles(files) {
        // Clear the existing file list
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            // Display a message if there are no files
            const listItem = document.createElement('li');
            listItem.className = 'text-gray-500 text-sm italic';
            listItem.textContent = 'No notes found';
            fileList.appendChild(listItem);
            return;
        }
        
        // Process and sort files
        const processedFiles = files.map(file => {
            // Extract just the file name without path and extension
            let fileName = file.path.split('/').pop().replace('.md', '');
            
            // Extract category if it exists in the path
            let category = '';
            const pathParts = file.path.split('/');
            if (pathParts.length > 2) {
                category = pathParts[pathParts.length - 2];
            }
            
            return {
                path: file.path,
                name: fileName,
                category: category,
                tags: file.tags || []
            };
        });
        
        // Sort files alphabetically by name and secondarily by category
        processedFiles.sort((a, b) => {
            // First sort by category if it exists
            if (a.category && b.category && a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            // Then sort by name
            return a.name.localeCompare(b.name);
        });
        
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Track categories for visual separation
        let lastCategory = null;
        
        // Add each file to the list
        processedFiles.forEach(file => {
            // If category is changing, add a visual separator
            if (file.category && file.category !== lastCategory) {
                lastCategory = file.category;
                
                // Only add a separator if this isn't the first category
                if (fragment.childElementCount > 0) {
                    const separator = document.createElement('li');
                    separator.className = 'py-1 my-1';
                    separator.style.borderBottom = '1px solid var(--border-color)';
                    fragment.appendChild(separator);
                }
            }
            
            const listItem = document.createElement('li');
            listItem.setAttribute('data-path', file.path);
            listItem.style.justifyContent = 'flex-start';
            listItem.style.textAlign = 'left';
            
            // Create inner structure for better styling
            const noteIcon = document.createElement('span');
            noteIcon.className = 'note-icon flex-shrink-0 mr-2';
            noteIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>`;
            
            const noteTitle = document.createElement('span');
            noteTitle.className = 'note-title text-left';
            noteTitle.textContent = file.name;
            noteTitle.title = file.name; // Add tooltip for long names
            noteTitle.style.flex = '1';
            noteTitle.style.minWidth = '0';
            
            // Add tags indicator if the file has tags
            if (file.tags && file.tags.length > 0) {
                const tagsIndicator = document.createElement('span');
                tagsIndicator.className = 'tags-indicator ml-1 text-xs text-indigo-500 flex-shrink-0';
                tagsIndicator.textContent = `(${file.tags.length})`;
                tagsIndicator.title = `Tags: ${file.tags.join(', ')}`;
                noteTitle.appendChild(tagsIndicator);
            }
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0';
            deleteBtn.title = 'Delete note';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            `;
            
            // Stop propagation to prevent opening the note when clicking the delete button
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFile(file.path);
            });
            
            listItem.appendChild(noteIcon);
            listItem.appendChild(noteTitle);
            listItem.appendChild(deleteBtn);
            
            // Add hover class to make the list item a proper group for hover actions
            listItem.classList.add('group');
            
            // Add click event to load the file
            listItem.addEventListener('click', () => {
                // Remove active class from all list items
                document.querySelectorAll('#file-list li').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to the clicked item
                listItem.classList.add('active');
                
                // Load the file
                loadFile(file.path);
                
                // Close sidebar on mobile after selecting a note
                if (isMobile && sidebar.classList.contains('active')) {
                    toggleSidebar();
                }
            });
            
            // Add right-click context menu for file operations
            listItem.addEventListener('contextmenu', e => {
                e.preventDefault();
                showContextMenu(e, file.path);
            });
            
            // Add to fragment
            fragment.appendChild(listItem);
        });
        
        // Append all items at once
        fileList.appendChild(fragment);
        
        // Virtual scrolling for large number of notes
        if (processedFiles.length > 100) {
            enableVirtualScrolling();
        }
    }

    // Enable virtual scrolling for large number of notes
    function enableVirtualScrolling() {
        const fileListContainer = fileList.parentElement;
        const items = Array.from(fileList.children);
        const itemHeight = items[0]?.offsetHeight || 30; // Default fallback height
        
        // Keep track of which items are rendered
        let renderedItems = new Set();
        let visibleRange = { start: 0, end: 0 };
        
        // Function to update which items are visible
        function updateVisibleItems() {
            const containerTop = fileListContainer.scrollTop;
            const containerHeight = fileListContainer.offsetHeight;
            
            // Calculate which items should be visible (with buffer)
            const bufferItems = 10; // Items to render before/after visible area
            const startIndex = Math.max(0, Math.floor(containerTop / itemHeight) - bufferItems);
            const endIndex = Math.min(items.length - 1, Math.ceil((containerTop + containerHeight) / itemHeight) + bufferItems);
            
            // If range hasn't changed, don't update DOM
            if (visibleRange.start === startIndex && visibleRange.end === endIndex) {
                return;
            }
            
            visibleRange = { start: startIndex, end: endIndex };
            
            // Hide items that are now outside the visible range
            renderedItems.forEach(index => {
                if (index < startIndex || index > endIndex) {
                    items[index].style.display = 'none';
                    renderedItems.delete(index);
                }
            });
            
            // Show items that are now inside the visible range
            for (let i = startIndex; i <= endIndex; i++) {
                if (!renderedItems.has(i) && items[i]) {
                    items[i].style.display = '';
                    renderedItems.add(i);
                }
            }
        }
        
        // Initial update and add scroll listener
        updateVisibleItems();
        fileListContainer.addEventListener('scroll', updateVisibleItems);
    }

    // Show context menu for a file
    function showContextMenu(e, filePath) {
        // Remove any existing context menu
        const existingMenu = document.getElementById('context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
        contextMenu.className = 'absolute bg-white shadow-lg rounded-lg overflow-hidden z-50 py-1';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        
        // Rename option
        const renameOption = document.createElement('div');
        renameOption.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
        renameOption.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rename
        `;
        renameOption.addEventListener('click', () => {
            const newName = prompt('Enter new name:', getFilename(filePath).replace('.md', ''));
            if (newName) {
                // TODO: Implement rename functionality
                closeContextMenu();
            }
        });
        
        // Edit Tags option
        const editTagsOption = document.createElement('div');
        editTagsOption.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
        editTagsOption.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Edit Tags
        `;
        editTagsOption.addEventListener('click', () => {
            showAddTagsModal(filePath);
            closeContextMenu();
        });
        
        // Change Category option
        const changeCategoryOption = document.createElement('div');
        changeCategoryOption.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
        changeCategoryOption.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Change Category
        `;
        changeCategoryOption.addEventListener('click', () => {
            // Get the current category
            const pathParts = filePath.split('/');
            let currentCategory = '';
            if (pathParts.length > 2) {
                currentCategory = pathParts[pathParts.length - 2];
            }
            
            // Create a dropdown with available categories
            let categoryOptions = '<option value="">No Category</option>';
            categories.forEach(cat => {
                const selected = cat === currentCategory ? 'selected' : '';
                categoryOptions += `<option value="${cat}" ${selected}>${cat}</option>`;
            });
            
            // Show custom dialog
            const dialog = document.createElement('div');
            dialog.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
            dialog.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full">
                    <h3 class="text-lg font-semibold mb-4">Change Category</h3>
                    <select id="category-select" class="w-full p-2 border rounded mb-4">
                        ${categoryOptions}
                    </select>
                    <div class="flex justify-end space-x-2">
                        <button id="cancel-category" class="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button id="save-category" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            
            // Handle dialog buttons
            document.getElementById('cancel-category').addEventListener('click', () => {
                dialog.remove();
            });
            
            document.getElementById('save-category').addEventListener('click', () => {
                const newCategory = document.getElementById('category-select').value;
                changeNoteCategory(filePath, newCategory);
                dialog.remove();
            });
            
            closeContextMenu();
        });
        
        // Delete option
        const deleteOption = document.createElement('div');
        deleteOption.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-600';
        deleteOption.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
        `;
        deleteOption.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this note?')) {
                deleteFile(filePath);
            }
            closeContextMenu();
        });
        
        contextMenu.appendChild(renameOption);
        contextMenu.appendChild(editTagsOption);
        contextMenu.appendChild(changeCategoryOption);
        contextMenu.appendChild(deleteOption);
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking outside
        document.addEventListener('click', closeContextMenu);
        
        // Close menu when scrolling
        document.addEventListener('scroll', closeContextMenu);
        
        // Prevent menu from going off-screen
        setTimeout(() => {
            const menuRect = contextMenu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
            }
            if (menuRect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
            }
        }, 0);
        
        function closeContextMenu() {
            contextMenu.remove();
            document.removeEventListener('click', closeContextMenu);
            document.removeEventListener('scroll', closeContextMenu);
        }
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
                
                // Update tags display
                updateTagsDisplay();
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
        categoryList.innerHTML = '';
        
        if (categories.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'category-empty';
            emptyItem.textContent = 'No categories';
            categoryList.appendChild(emptyItem);
            return;
        }
        
        // Sort categories alphabetically
        categories.sort((a, b) => a.localeCompare(b));
        
        const fragment = document.createDocumentFragment();
        
        // Add "All Notes" option
        const allNotesItem = document.createElement('li');
        allNotesItem.className = 'category-item';
        allNotesItem.style.justifyContent = 'flex-start';
        allNotesItem.style.textAlign = 'left';
        allNotesItem.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span class="category-name text-left" style="min-width: 0; flex: 1;">All Notes</span>
        `;
        
        allNotesItem.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
            });
            allNotesItem.classList.add('active');
            loadFiles();
        });
        
        fragment.appendChild(allNotesItem);
        
        // Add each category
        categories.forEach(category => {
            const listItem = document.createElement('li');
            listItem.className = 'category-item';
            listItem.setAttribute('data-category', category);
            listItem.style.justifyContent = 'flex-start';
            listItem.style.textAlign = 'left';
            
            listItem.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span class="category-name text-left" style="min-width: 0; flex: 1;" title="${category}">${category}</span>
                <button class="category-delete-btn flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;
            
            // Add click event to filter by category
            listItem.addEventListener('click', (e) => {
                // Don't trigger if the delete button was clicked
                if (e.target.closest('.category-delete-btn')) {
                    return;
                }
                
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                });
                listItem.classList.add('active');
                
                searchByCategory(category);
            });
            
            // Add click event to delete button
            const deleteBtn = listItem.querySelector('.category-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete the category "${category}"? This will not delete the notes in this category.`)) {
                    deleteCategory(category);
                }
            });
            
            fragment.appendChild(listItem);
        });
        
        categoryList.appendChild(fragment);
        
        // Also update the category dropdown in the new note modal
        updateCategoryDropdown();
    }
    
    // Update the category dropdown in the new note modal
    function updateCategoryDropdown() {
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
        // Collect all tags from files
        allTags = new Set();
        
        fetch('/api/files')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Process all files and collect tags
                    data.data.forEach(file => {
                        if (file.tags && Array.isArray(file.tags)) {
                            file.tags.forEach(tag => allTags.add(tag));
                        }
                    });
                    
                    // Display the collected tags
                    if (allTags.size === 0) {
                        tagsContainer.innerHTML = '<span class="text-gray-500 text-sm italic">No tags found</span>';
                        return;
                    }
                    
                    tagsContainer.innerHTML = '';
                    
                    // Add each tag
                    Array.from(allTags).sort().forEach(tag => {
                        const tagSpan = document.createElement('span');
                        tagSpan.className = 'tag text-xs bg-indigo-100 text-indigo-800 rounded px-2 py-1 cursor-pointer hover:bg-indigo-200 flex items-center gap-1';
                        
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
            })
            .catch(error => {
                console.error('Error loading tags:', error);
                tagsContainer.innerHTML = '<span class="text-red-500 text-sm italic">Error loading tags</span>';
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
                
                // Update tags display
                updateTagsDisplay();
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

    // Change a note's category
    function changeNoteCategory(filePath, newCategory) {
        // Extract the filename from the path
        const fileName = filePath.split('/').pop();
        
        fetch('/api/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: filePath,
                newPath: newCategory ? `/${newCategory}/${fileName}` : `/${fileName}`
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // If the current file is the one being moved, update currentFile
                if (currentFile === filePath) {
                    currentFile = data.newPath;
                }
                
                // Refresh the file list
                loadFiles();
                
                // Show success message
                showToast('Note category changed successfully', 'success');
            } else {
                console.error('Error changing category:', data.message);
                showToast(`Error: ${data.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error changing category:', error);
            showToast('Error changing category. Please try again.', 'error');
        });
    }

    // Show toast notification
    function showToast(message, type = 'success') {
        const toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow to enable CSS transition
        toast.offsetHeight;
        
        // Show toast
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            
            // Remove from DOM after fade out
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}); 