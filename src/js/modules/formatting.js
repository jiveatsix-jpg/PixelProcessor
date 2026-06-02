// ── Text Formatting ───────────────────────────────────────────────────────────
// Bold, Italic, Highlight, Alignment, Font Family, Font Size, Text Color + Palette

import { $, $q } from '../utils/dom.js';
import { formatCommand } from '../utils/formatting.js';
import { openColorPicker } from './colorPicker.js';
import { state, savePaletteToStorage } from '../state.js';
import { DEFAULT_PALETTE } from '../config.js';

let _editor = null;

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

        swatch.addEventListener('click', (e) => {
            const c = e.target.getAttribute('data-color');
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
}

function _applyColor(color, input, indicator) {
    input.value                       = color;
    indicator.style.backgroundColor   = color;
    execCmd('foreColor', color);
}
