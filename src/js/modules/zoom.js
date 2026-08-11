// ── Zoom Module ───────────────────────────────────────────────────────────────
// Ctrl + Wheel  → zoom in / out
// Ctrl + 0      → reset to 100%
// Displays a transient zoom indicator in the toolbar.

import { $ } from '../utils/dom.js';

const ZOOM_STEP = 0.1;
const ZOOM_MIN  = 0.3;
const ZOOM_MAX  = 3.0;

let _zoom       = 1.0;
let _target     = null;   // the element we scale (editor-container inner wrapper)
let _indicator  = null;
let _hideTimer  = null;

export function initZoom(editorContainer) {
    _target = editorContainer;

    // Create zoom indicator badge in the toolbar
    _indicator = document.createElement('div');
    _indicator.id = 'zoom-indicator';
    Object.assign(_indicator.style, {
        position        : 'fixed',
        bottom          : '18px',
        right           : '18px',
        background      : 'var(--panel-bg)',
        border          : '1px solid var(--border-color)',
        color           : 'var(--accent-color)',
        fontFamily      : 'var(--font-secondary)',
        fontSize        : '14px',
        padding         : '4px 10px',
        borderRadius    : '4px',
        opacity         : '0',
        transition      : 'opacity 0.2s',
        pointerEvents   : 'none',
        zIndex          : '9999',
        letterSpacing   : '1px',
    });
    document.body.appendChild(_indicator);

    // Ctrl + Wheel
    editorContainer.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        _setZoom(_zoom + delta);
    }, { passive: false });

    // Ctrl + 0  → reset
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '0') {
            e.preventDefault();
            _setZoom(1.0);
        }
    });
}

function _setZoom(level) {
    _zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(level * 10) / 10));
    // Scale the container's inner content; use transform-origin top-center
    // so zoom feels anchored to the top of the document.
    _target.style.transformOrigin = 'top center';
    _target.style.transform       = `scale(${_zoom})`;
    // Compensate height so the scrollable area doesn't collapse
    _target.style.marginBottom    = `${(_zoom - 1) * _target.offsetHeight}px`;
    _showIndicator();
}

function _showIndicator() {
    _indicator.textContent = Math.round(_zoom * 100) + '%';
    _indicator.style.opacity = '1';
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => { _indicator.style.opacity = '0'; }, 1500);
}
