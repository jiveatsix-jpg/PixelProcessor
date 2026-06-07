// ── Text Formatting ───────────────────────────────────────────────────────────
// Bold, Italic, Highlight, Alignment, Font Family, Font Size, Text Color + Palette

import { $, $q } from '../utils/dom.js';
import { formatCommand } from '../utils/formatting.js';
import { openColorPicker } from './colorPicker.js';
import { state, savePaletteToStorage, loadSavedPalettes, savePalette, deleteSavedPalette } from '../state.js';
import { DEFAULT_PALETTE } from '../config.js';

let _editor = null;
let _savedRange = null; // last non-collapsed selection range

// Capture selection before it's lost (e.g., when clicking a toolbar button)
document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return;
    const node = sel.anchorNode?.parentElement;
    if (!node?.closest?.('.pixel-editor, .page-content')) return;
    _savedRange = sel.getRangeAt(0).cloneRange();
});

const execCmd = (cmd, value = null) => {
    formatCommand(cmd, value);

    // Keep focus in the current page in paged mode
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const node = sel.anchorNode?.parentElement;
        const page = node?.closest?.('.page-content');
        if (page) page.focus();
    }
};

export function initFormatting(editor) {
    _editor = editor;

    // Undo / Redo (browser native)
    $('btn-undo').addEventListener('click', () => document.execCommand('undo'));
    $('btn-redo').addEventListener('click', () => document.execCommand('redo'));

    // Basic commands
    $('btn-bold')          .addEventListener('click', () => execCmd('bold'));
    $('btn-italic')        .addEventListener('click', () => execCmd('italic'));
    $('btn-highlight')     .addEventListener('click', () => execCmd('hiliteColor', 'yellow'));
    $('btn-align-left')    .addEventListener('click', () => execCmd('justifyLeft'));
    $('btn-align-center')  .addEventListener('click', () => execCmd('justifyCenter'));
    $('btn-align-right')   .addEventListener('click', () => execCmd('justifyRight'));
    $('btn-align-justify') .addEventListener('click', () => execCmd('justifyFull'));

    // Font family
    $('font-family').addEventListener('change', (e) => execCmd('fontName', e.target.value));

    // Font size
    const fontSizeEl = $('font-size');
    if (fontSizeEl) fontSizeEl.addEventListener('change', (e) => execCmd('fontSize', e.target.value));

    // ── Text color + Palette ─────────────────────────────────────────────────
    const colorInput     = $('text-color');
    const colorIndicator = $('text-color-indicator');
    const swatches       = Array.from(document.querySelectorAll('.swatch'));

    colorIndicator.style.backgroundColor = colorInput.value;
    swatches.forEach((swatch, i) => {
        const color = state.currentPalette[i] || DEFAULT_PALETTE[i];
        swatch.style.backgroundColor = color;
        swatch.dataset.color         = color;
        swatch.setAttribute('data-color', color);
        swatch.title = 'Click Izquierdo: Elegir\nClick Derecho: Editar';

        swatch.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // left click only
            e.preventDefault(); // prevent button from stealing focus
            const c = e.currentTarget.getAttribute('data-color');
            _applyColor(c, colorInput, colorIndicator);
        });

        swatch.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openColorPicker(swatch.getAttribute('data-color'), 'Editar Paleta', (hex) => {
                swatch.style.backgroundColor = hex;
                swatch.dataset.color         = hex;
                swatch.setAttribute('data-color', hex);
                state.currentPalette[i]      = hex;
                savePaletteToStorage();
                _applyColor(hex, colorInput, colorIndicator);
            });
        });
    });

    // Custom color trigger
    $q('[data-target="text-color"]').addEventListener('click', () => {
        openColorPicker(colorInput.value, 'Color de Texto', (hex) => {
            _applyColor(hex, colorInput, colorIndicator);
        });
    });

    // ── Palette Manager (save / load named palettes) ─────────────────────────
    const paletteSelect = $('palette-select');
    const btnSave       = $('btn-save-palette');
    const btnDelete     = $('btn-delete-palette');

    /** Refresh the dropdown with saved palettes. */
    function _populatePaletteSelect() {
        const current = paletteSelect.value;
        paletteSelect.innerHTML = '<option value="">— PALETAS —</option>';
        const palettes = loadSavedPalettes();
        for (const name of Object.keys(palettes).sort()) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            paletteSelect.appendChild(opt);
        }
        // Restore selection if still there
        if ([...paletteSelect.options].some(o => o.value === current)) {
            paletteSelect.value = current;
        }
    }

    /** Apply a palette (array of hex colors) to the UI and state. */
    function _applyPalette(colors) {
        state.currentPalette = [...colors];
        savePaletteToStorage();
        swatches.forEach((sw, i) => {
            const c = state.currentPalette[i] || '#000000';
            sw.style.backgroundColor = c;
            sw.dataset.color         = c;
            sw.setAttribute('data-color', c);
        });
    }

    // Load palette from dropdown
    paletteSelect.addEventListener('change', () => {
        const name = paletteSelect.value;
        if (!name) return;
        const palettes = loadSavedPalettes();
        if (palettes[name]) {
            _applyPalette(palettes[name]);
        }
    });

    // Save current palette
    btnSave.addEventListener('click', () => {
        const name = prompt('Nombre para esta paleta:');
        if (!name || !name.trim()) return;
        savePalette(name.trim(), state.currentPalette);
        _populatePaletteSelect();
        paletteSelect.value = name.trim();
    });

    // Delete selected palette
    btnDelete.addEventListener('click', () => {
        const name = paletteSelect.value;
        if (!name) return;
        if (!confirm(`¿Eliminar la paleta "${name}"?`)) return;
        deleteSavedPalette(name);
        _populatePaletteSelect();
    });

    // Initial population
    _populatePaletteSelect();
}

function _applyColor(color, input, indicator) {
    input.value                       = color;
    indicator.style.backgroundColor   = color;

    // Restore saved selection if current one is lost (e.g., button click cleared it)
    const sel = window.getSelection();
    if ((!sel.rangeCount || sel.getRangeAt(0).collapsed) && _savedRange) {
        sel.removeAllRanges();
        sel.addRange(_savedRange);
    }

    execCmd('foreColor', color);
}
