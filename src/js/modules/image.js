// ── Image Module 2.0 ──────────────────────────────────────────────────────────
// Handles: file upload, URL input, live preview, and image manipulation.
// Features: Drag to move, corner handle to resize, delete on hover/select.

import { $ } from '../utils/dom.js';
import { syncActiveTabContent } from '../state.js';

let _editor = null;
let _activeImg = null;
let _overlay = null;

// Interaction State
let _isDragging = false;
let _isResizing = false;
let _dragStart = { x: 0, y: 0 };
let _imgStart = { x: 0, y: 0, w: 0, h: 0 };

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

    const container = document.getElementById('editor-container');
    const cRect = container.getBoundingClientRect();
    const iRect = _activeImg.getBoundingClientRect();

    _overlay.style.display = 'block';
    _overlay.style.width = iRect.width + 'px';
    _overlay.style.height = iRect.height + 'px';
    _overlay.style.left = (iRect.left - cRect.left + container.scrollLeft) + 'px';
    _overlay.style.top = (iRect.top - cRect.top + container.scrollTop) + 'px';
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
    _editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            _activeImg = e.target;
            _syncOverlay();
        } else if (!_overlay.contains(e.target)) {
            _deselect();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (_isDragging && _activeImg) {
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
            _syncOverlay();
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
        if (_isDragging || _isResizing) {
            syncActiveTabContent(_editor);
            _editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        _isDragging = false;
        _isResizing = false;
    });

    // Handle window resize/scroll
    document.getElementById('editor-container').addEventListener('scroll', _syncOverlay);
    window.addEventListener('resize', _syncOverlay);
}

function _startDrag(e) {
    if (!_activeImg) return;
    _isDragging = true;
    _dragStart = { x: e.clientX, y: e.clientY };

    if (_activeImg.style.position !== 'absolute') {
        const iRect = _activeImg.getBoundingClientRect();
        const eRect = _editor.getBoundingClientRect();
        _activeImg.style.position = 'absolute';
        _activeImg.style.left = (iRect.left - eRect.left + _editor.scrollLeft) + 'px';
        _activeImg.style.top = (iRect.top - eRect.top + _editor.scrollTop) + 'px';
        _activeImg.style.margin = '0';
    }

    _imgStart = {
        x: parseFloat(_activeImg.style.left) || 0,
        y: parseFloat(_activeImg.style.top) || 0
    };
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

function _setupModalListeners() {
    const modal = $('image-modal');
    const fileInput = $('image-upload');
    const urlInput = $('img-url-input');
    const confirmBtn = $('btn-confirm-image');
    const previewImg = $('img-preview');
    const previewWrap = $('img-preview-wrap');
    const sizeControls = $('img-size-controls');

    // Open modal
    $('btn-image').addEventListener('click', () => {
        _resetModal();
        modal.classList.remove('hidden');
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
        _insertImage(src, width, align);
        modal.classList.add('hidden');
    });

    // Cancel
    $('btn-cancel-image').addEventListener('click', () => modal.classList.add('hidden'));

    function _showPreview(src) {
        previewImg.src = src;
        previewWrap.style.display = 'block';
        sizeControls.style.display = 'block';
        confirmBtn.disabled = false;
    }

    function _resetModal() {
        previewImg.src = '';
        previewWrap.style.display = 'none';
        sizeControls.style.display = 'none';
        confirmBtn.disabled = true;
        urlInput.value = '';
        fileInput.value = '';
    }
}

/**
 * Inserts the image into the editor.
 */
function _insertImage(src, widthPct, align) {
    _editor.focus();
    
    // Create the image element with specific pixel styles
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Pixel Image';
    
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

    img.setAttribute('style', img.getAttribute('style') + baseStyle);

    // Insert via range to avoid execCommand issues if possible, 
    // but execCommand is still useful for undo/redo integration in simple setups
    const sel = window.getSelection();
    if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
        
        // Add a paragraph after for easier typing
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        img.after(p);
        
        // Move selection to new paragraph
        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}
