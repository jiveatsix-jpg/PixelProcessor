// ── Universal Color Picker Modal ──────────────────────────────────────────────

import { $, $q } from '../utils/dom.js';
import { COLOR_GRID_PRESETS } from '../config.js';

const modal         = $('color-picker-modal');
const titleEl       = $('color-picker-title');
const hexInput      = $('custom-hex-input');
const nativePicker  = $('native-color-picker');
const paletteGrid   = $q('.retro-palette-grid');
const btnCancel     = $('btn-cancel-color');
const btnConfirm    = $('btn-confirm-color');

let _onConfirm = null;
let _onCancel  = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

function _setColor(hex) {
    hexInput.value    = hex.toUpperCase();
    nativePicker.value = hex;
}

function _buildGrid() {
    paletteGrid.innerHTML = '';
    COLOR_GRID_PRESETS.forEach(color => {
        const btn = document.createElement('button');
        btn.className          = 'grid-swatch';
        btn.style.backgroundColor = color;
        btn.onclick = () => _setColor(color);
        paletteGrid.appendChild(btn);
    });
}

function _isValidHex(val) {
    return /^#[0-9A-F]{6}$/i.test(val);
}

// ── Wire once ─────────────────────────────────────────────────────────────────

nativePicker.addEventListener('input',  (e) => { hexInput.value = e.target.value.toUpperCase(); });
hexInput.addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (_isValidHex(v)) nativePicker.value = v;
});

btnCancel.onclick  = () => { modal.classList.add('hidden'); _onCancel?.(); };
btnConfirm.onclick = () => {
    let val = hexInput.value.trim().toUpperCase();
    if (/^[0-9A-F]{3,6}$/i.test(val)) val = '#' + val;
    if (_isValidHex(val)) {
        _onConfirm?.(val);
        modal.classList.add('hidden');
    } else {
        alert('Código no válido. Usa formato Hex (#RRGGBB).');
    }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Opens the color picker modal.
 * @param {string}   initialColor  – current hex color (e.g. '#FF00FF')
 * @param {string}   title         – modal heading
 * @param {Function} onConfirm     – called with the chosen hex string
 * @param {Function} [onCancel]    – called if user cancels
 */
export function openColorPicker(initialColor, title, onConfirm, onCancel = null) {
    titleEl.textContent = title;
    _setColor(initialColor || '#FFFFFF');
    _onConfirm = onConfirm;
    _onCancel  = onCancel;
    _buildGrid();
    modal.classList.remove('hidden');
    hexInput.focus();
}
