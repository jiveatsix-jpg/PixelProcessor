// ── Image Module 2.0 ──────────────────────────────────────────────────────────
// Handles: file upload, URL input, live preview, and image manipulation.
// Features: Drag to move, corner handle to resize, delete on hover/select.

import { $ } from '../utils/dom.js';
import { syncActiveTabContent } from '../state.js';

let _editor = null;
let _activeImg = null;
let _overlay   = null;
let _savedRange = null;

// Interaction State
let _isDragging = false;
let _dragStart = { x: 0, y: 0 };
let _imgStart  = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Initializes the image module.
 * @param {HTMLElement} editor The editor element.
 */
export function initImage(editor) {
    _editor = editor;
    _createOverlay();
    _setupModalListeners();
    _setupInteractionListeners();
}

/**
 * Creates the selection/resize overlay.
 */
function _createOverlay() {
    _overlay = document.createElement('div');
    _overlay.id = 'img-action-overlay';
    _overlay.className = 'pixel-overlay';
    
    // Style the overlay via JS for precision, though CSS classes are preferred
    Object.assign(_overlay.style, {
        position: 'absolute',
        display: 'none',
        border: '2px solid var(--select-color)',
        zIndex: '100',
        pointerEvents: 'all',
        cursor: 'move'
    });

    // Resize Handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    Object.assign(handle.style, {
        position: 'absolute',
        bottom: '-6px',
        right: '-6px',
        width: '12px',
        height: '12px',
        backgroundColor: 'var(--select-color)',
        cursor: 'se-resize',
        border: '2px solid var(--bg-color)'
    });

    // Delete Button
    const delBtn = document.createElement('div');
    delBtn.className = 'overlay-del-btn';
    delBtn.innerHTML = '×';
    Object.assign(delBtn.style, {
        position: 'absolute',
        top: '-12px',
        right: '-12px',
        width: '24px',
        height: '24px',
        backgroundColor: 'var(--accent-color)',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
    });

    // Center Button
    const centerBtn = document.createElement('div');
    centerBtn.className = 'overlay-center-btn';
    centerBtn.innerHTML = '↔';
    centerBtn.title = 'Center Image';
    Object.assign(centerBtn.style, {
        position: 'absolute',
        top: '-12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '24px',
        height: '24px',
        backgroundColor: 'var(--select-color)',
        color: 'var(--bg-color)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: '101'
    });

    centerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _centerActiveImage();
    });

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _deleteActiveImage();
    });

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _startResize(e);
    });

    _overlay.addEventListener('mousedown', (e) => {
        if (e.target === handle) return;
        e.preventDefault();
        _startDrag(e);
    });

    _overlay.appendChild(handle);
    _overlay.appendChild(delBtn);
    _overlay.appendChild(centerBtn);
    document.getElementById('editor-container').appendChild(_overlay);
}

/**
 * Syncs the overlay position with the active image.
 */
function _syncOverlay() {
    if (!_activeImg) {
        _overlay.style.display = 'none';
        return;
    }

    const parent = _activeImg.offsetParent || document.body;
    if (_overlay.parentNode !== parent) {
        parent.appendChild(_overlay);
    }

    _overlay.style.display = 'block';
    _overlay.style.width = _activeImg.offsetWidth + 'px';
    _overlay.style.height = _activeImg.offsetHeight + 'px';
    _overlay.style.left = _activeImg.offsetLeft + 'px';
    _overlay.style.top = _activeImg.offsetTop + 'px';
}

function _deleteActiveImage() {
    if (!_activeImg) return;
    const parent = _activeImg.parentElement;
    _activeImg.remove();
    // Clean up empty paragraphs
    if (parent && parent.tagName === 'P' && parent.innerHTML.trim() === '') {
        parent.remove();
    }
    _deselect();
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function _deselect() {
    _activeImg = null;
    _overlay.style.display = 'none';
}

// ── Interaction Logic ────────────────────────────────────────────────────────

function _setupInteractionListeners() {
    const container = $('editor-container');

    // Listen on container to support paged mode (images inside page-content)
    container.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            _activeImg = e.target;
            _syncOverlay();
        } else if (!_overlay.contains(e.target)) {
            _deselect();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (_isDragging && _activeImg) {
            _overlay.style.display = 'none'; // Hide overlay for smooth drag
            
            const dx = e.clientX - _dragStart.x;
            const dy = e.clientY - _dragStart.y;

            let nx = _imgStart.x + dx;
            let ny = _imgStart.y + dy;

            if (e.ctrlKey) { // Snap to grid
                nx = Math.round(nx / 16) * 16;
                ny = Math.round(ny / 16) * 16;
            }

            _activeImg.style.left = nx + 'px';
            _activeImg.style.top = ny + 'px';
        }

        if (_isResizing && _activeImg) {
            const dx = e.clientX - _dragStart.x;
            let newW = Math.max(32, _imgStart.w + dx);

            if (e.ctrlKey) newW = Math.round(newW / 16) * 16;

            _activeImg.style.width = newW + 'px';
            _activeImg.style.height = 'auto'; // Maintain aspect ratio
            _syncOverlay();
        }
    });

    document.addEventListener('mouseup', () => {
        if (_isDragging && _activeImg) {
            // Smart re-parenting for Paged Mode
            const imgRect = _activeImg.getBoundingClientRect();
            const pages = Array.from(document.querySelectorAll('.page-content'));
            
            if (pages.length > 0) {
                let targetPage = pages[0];
                let maxOverlap = 0;
                
                // Find which page the image overlaps with the most
                for (const page of pages) {
                    const pRect = page.getBoundingClientRect();
                    const overlapStart = Math.max(imgRect.top, pRect.top);
                    const overlapEnd = Math.min(imgRect.bottom, pRect.bottom);
                    const overlap = Math.max(0, overlapEnd - overlapStart);
                    
                    if (overlap > maxOverlap) {
                        maxOverlap = overlap;
                        targetPage = page;
                    }
                }
                
                const currentWrapper = _activeImg.closest('.editor-line');
                if (targetPage && currentWrapper && currentWrapper.parentElement !== targetPage) {
                    // Reparent wrapper to new page
                    targetPage.appendChild(currentWrapper);
                    // Adjust top coordinate relative to new page
                    const tpRect = targetPage.getBoundingClientRect();
                    const newTop = imgRect.top - tpRect.top;
                    _activeImg.style.top = newTop + 'px';
                }
            }
        }

        if (_isDragging || _isResizing) {
            _syncOverlay();
            syncActiveTabContent(_editor);
            const container = document.getElementById('editor-container');
            container.dispatchEvent(new Event('input', { bubbles: true }));
        }
        _isDragging = false;
        _isResizing = false;
    });

    // Handle window resize/scroll
    container.addEventListener('scroll', _syncOverlay);
    window.addEventListener('resize', _syncOverlay);
}

function _startDrag(e) {
    if (!_activeImg) return;
    _isDragging = true;
    _dragStart = { x: e.clientX, y: e.clientY };
    
    // Ensure it's floating
    if (_activeImg.style.position !== 'absolute') {
        _makeFloating(_activeImg);
    }
    
    _imgStart = {
        x: parseFloat(_activeImg.style.left) || 0,
        y: parseFloat(_activeImg.style.top) || 0
    };
}

function _makeFloating(img) {
    const iRect = img.getBoundingClientRect();
    const parent = img.closest('.page-content') || document.getElementById('editor-container');
    const pRect = parent.getBoundingClientRect();
    
    img.style.position = 'absolute';
    img.style.zIndex = '50';
    img.style.margin = '0';
    // Position relative to parent page
    img.style.left = (iRect.left - pRect.left + parent.scrollLeft) + 'px';
    img.style.top = (iRect.top - pRect.top + parent.scrollTop) + 'px';
}

function _startResize(e) {
    if (!_activeImg) return;
    _isResizing = true;
    _dragStart = { x: e.clientX, y: e.clientY };
    _imgStart = {
        w: _activeImg.getBoundingClientRect().width,
        h: _activeImg.getBoundingClientRect().height
    };
    _activeImg.style.maxWidth = 'none';
}

// ── Modal & Insertion ────────────────────────────────────────────────────────

function _centerActiveImage() {
    if (!_activeImg) return;

    // Ensure it's floating
    if (_activeImg.style.position !== 'absolute') {
        _makeFloating(_activeImg);
    }

    const parent = _activeImg.closest('.page-content');
    if (!parent) return;

    const pRect = parent.getBoundingClientRect();
    const imgWidth = _activeImg.offsetWidth;
    
    // We want to center it within the page-content (which includes padding)
    // Actually, centering usually means the middle of the available area.
    const newLeft = (pRect.width - imgWidth) / 2;
    
    _activeImg.style.left = newLeft + 'px';
    
    _syncOverlay();
    syncActiveTabContent(_editor);
    const container = document.getElementById('editor-container');
    container.dispatchEvent(new Event('input', { bubbles: true }));
}

function _setupModalListeners() {
    const modal = $('image-modal');
    const fileInput = $('image-upload');
    const urlInput = $('img-url-input');
    const confirmBtn = $('btn-confirm-image');
    const previewImg = $('img-preview');
    const previewWrap = $('img-preview-wrap');
    const sizeControls = $('img-size-controls');

    const tabFile = $('img-tab-file');
    const tabUrl = $('img-tab-url');
    const panelFile = $('img-panel-file');
    const panelUrl = $('img-panel-url');

    // Open modal
    $('btn-image').addEventListener('click', () => {
        // Save the current selection/range before focus moves to modal
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            _savedRange = sel.getRangeAt(0).cloneRange();
        } else {
            _savedRange = null;
        }

        _resetModal();
        modal.classList.remove('hidden');
    });

    // Tab switching
    tabFile.addEventListener('click', () => {
        tabFile.classList.add('accent-btn');
        tabUrl.classList.remove('accent-btn');
        panelFile.style.display = 'block';
        panelUrl.style.display = 'none';
    });

    tabUrl.addEventListener('click', () => {
        tabUrl.classList.add('accent-btn');
        tabFile.classList.remove('accent-btn');
        panelFile.style.display = 'none';
        panelUrl.style.display = 'block';
    });

    // File selection
    $('img-drop-zone').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => _showPreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    });

    // URL Loading
    $('img-url-load').addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) _showPreview(url);
    });

    // Confirm insertion
    confirmBtn.addEventListener('click', () => {
        const src = previewImg.src;
        const width = parseInt($('img-width').value) || 100;
        const align = $('img-align').value;
        if (src) {
            _insertImage(src, width, align);
            modal.classList.add('hidden');
        }
    });

    // Cancel
    $('btn-cancel-image').addEventListener('click', () => modal.classList.add('hidden'));

    function _showPreview(src) {
        previewImg.src = src;
        previewWrap.style.display = 'block';
        sizeControls.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.classList.add('accent-btn');
    }

    function _resetModal() {
        previewImg.src = '';
        previewWrap.style.display = 'none';
        sizeControls.style.display = 'none';
        confirmBtn.disabled = true;
        confirmBtn.classList.remove('accent-btn');
        urlInput.value = '';
        fileInput.value = '';
        // Reset to file tab
        tabFile.click();
    }
}

/**
 * Inserts the image into the editor.
 */
function _insertImage(src, widthPct, align) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Pixel Image';
    
    // Pixel-art specific styling
    let baseStyle = 'image-rendering: pixelated; border: 2px solid var(--border-color); box-shadow: 4px 4px 0 var(--shadow-color);';
    img.style.maxWidth = widthPct + '%';
    
    if (align === 'center') {
        img.style.display = 'block';
        img.style.margin = '20px auto';
    } else if (align === 'block') {
        img.style.display = 'block';
        img.style.margin = '20px 0';
    } else {
        img.style.display = 'inline-block';
        img.style.margin = '10px';
    }

    img.setAttribute('style', (img.getAttribute('style') || '') + baseStyle);

    // Restore the range where we want to insert
    const sel = window.getSelection();
    if (_savedRange) {
        sel.removeAllRanges();
        sel.addRange(_savedRange);
    }

    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        
        // Wrap image in a line to maintain PagedMode structure
        const lineWrapper = document.createElement('div');
        lineWrapper.className = 'editor-line';
        lineWrapper.style.textAlign = align === 'center' ? 'center' : 'left';
        lineWrapper.appendChild(img);
        
        range.insertNode(lineWrapper);
        
        // Immediately make it floating so it doesn't push text down
        _makeFloating(img);
        
        // Create an empty line after the image for easier typing
        const nextLine = document.createElement('div');
        nextLine.className = 'editor-line';
        nextLine.innerHTML = '<br>';
        lineWrapper.after(nextLine);
        
        // Move selection to the new line
        const newRange = document.createRange();
        newRange.setStart(nextLine, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        
        // Ensure the correct element is focused (important for paged mode)
        const page = nextLine.closest('.page-content');
        if (page) page.focus();
    } else {
        // Fallback: if no range, append to first visible page
        const firstPage = document.querySelector('.page-content');
        if (firstPage) {
            const line = document.createElement('div');
            line.className = 'editor-line';
            line.appendChild(img);
            firstPage.appendChild(line);
            firstPage.focus();
        }
    }

    // Sync and notify
    syncActiveTabContent(_editor);
    const event = new Event('input', { bubbles: true });
    _editor.dispatchEvent(event);
    document.getElementById('editor-container').dispatchEvent(event);
    
    // Clear saved range
    _savedRange = null;
}
