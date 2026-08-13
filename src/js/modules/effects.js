// ── Visual Effects: Glow & Chroma Morph ──────────────────────────────────────

import { $, $q, wrapSelection, unwrapElement } from '../utils/dom.js';
import { openColorPicker } from './colorPicker.js';
import { syncActiveTabContent } from '../state.js';
import { LS_KEYS } from '../config.js';

export function initEffects(editor) {
    _initGlow(editor);
    _initOutline(editor);
    _initChromaMorph(editor);
}

/** Closest ancestor of the current selection's anchor with the given class,
 *  or null. Lets the glow/chroma buttons act as a toggle instead of always
 *  nesting a new wrapper inside whatever's already applied. */
function _selectionAncestorWithClass(className) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node?.closest?.('.' + className) || null;
}

/** Wires a color-toggle effect button (Neon Glow, Contorno): applies
 *  `className` to the selection with `cssVar` set to the picked color,
 *  updates it in place if a different color is picked while already
 *  applied, or removes it if the same color is picked again.
 *
 *  Uses mousedown+preventDefault (like the color swatches in formatting.js)
 *  plus a saved-selection fallback, so the toolbar button click doesn't
 *  lose the selection before the handler runs — without that, a second
 *  click meant to remove the effect would find nothing to act on. */
function _initColorToggleEffect(editor, { btnId, colorInputId, colorIndicatorId, className, cssVar, pickerTitle, lsKey, defaultColor }) {
    const colorInput     = $(colorInputId);
    const colorIndicator = $(colorIndicatorId);

    const saved = localStorage.getItem(lsKey) || defaultColor;
    colorInput.value                    = saved;
    colorIndicator.style.backgroundColor = saved;

    let savedRange = null;
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return;
        const node = sel.anchorNode?.parentElement;
        if (!node?.closest?.('.pixel-editor, .page-content')) return;
        savedRange = sel.getRangeAt(0).cloneRange();
    });

    const btn = $(btnId);
    btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
    });
    btn.addEventListener('click', () => {
        try {
            const sel = window.getSelection();
            if (!sel.rangeCount && savedRange) {
                sel.addRange(savedRange);
            }

            const existing = _selectionAncestorWithClass(className);

            if (existing) {
                const currentColor = getComputedStyle(existing).getPropertyValue(cssVar).trim();
                if (currentColor.toLowerCase() === colorInput.value.toLowerCase()) {
                    // Same color pressed again on already-applied text -> remove it.
                    unwrapElement(existing);
                } else {
                    // A different color was picked -> update this wrapper in place
                    // instead of nesting a second one around it.
                    existing.style.setProperty(cssVar, colorInput.value);
                }
                editor.focus();
                syncActiveTabContent(editor);
                return;
            }

            const applied = wrapSelection(className, { [cssVar]: colorInput.value });
            if (!applied) { editor.focus(); return; }
            editor.focus();
            syncActiveTabContent(editor);
        } catch (e) {
            console.error(e);
            alert('No se pudo aplicar el efecto. Intenta evitar cruzar saltos de línea largos.');
            editor.focus();
        }
    });

    $q(`[data-target="${colorInputId}"]`).addEventListener('click', () => {
        openColorPicker(colorInput.value, pickerTitle, (hex) => {
            colorInput.value                    = hex;
            colorIndicator.style.backgroundColor = hex;
            localStorage.setItem(lsKey, hex);
        });
    });
}

// ── Neon Glow ─────────────────────────────────────────────────────────────────

function _initGlow(editor) {
    _initColorToggleEffect(editor, {
        btnId           : 'btn-glow-toggle',
        colorInputId    : 'glow-color-input',
        colorIndicatorId: 'glow-color-indicator',
        className       : 'neon-glow',
        cssVar          : '--glow-color',
        pickerTitle     : 'Color del Brillo',
        lsKey           : LS_KEYS.GLOW_COLOR,
        defaultColor    : '#ffffff',
    });
}

// ── Contorno (pixel-font outline) ────────────────────────────────────────────

function _initOutline(editor) {
    _initColorToggleEffect(editor, {
        btnId           : 'btn-outline-toggle',
        colorInputId    : 'outline-color-input',
        colorIndicatorId: 'outline-color-indicator',
        className       : 'pixel-outline',
        cssVar          : '--outline-color',
        pickerTitle     : 'Color del Contorno',
        lsKey           : LS_KEYS.OUTLINE_COLOR,
        defaultColor    : '#000000',
    });
}

// ── Chroma Morph (animated gradient text) ────────────────────────────────────

function _initChromaMorph(editor) {
    const animColor1 = $('anim-color-1');
    const animColor2 = $('anim-color-2');
    const animSpeed  = $('anim-speed');
    const ind1       = animColor1.nextElementSibling;
    const ind2       = animColor2.nextElementSibling;

    ind1.style.backgroundColor = animColor1.value;
    ind2.style.backgroundColor = animColor2.value;

    $q('[data-target="anim-color-1"]').addEventListener('click', () => {
        openColorPicker(animColor1.value, 'Chroma 1', (c) => {
            animColor1.value = c; ind1.style.backgroundColor = c;
        });
    });

    $q('[data-target="anim-color-2"]').addEventListener('click', () => {
        openColorPicker(animColor2.value, 'Chroma 2', (c) => {
            animColor2.value = c; ind2.style.backgroundColor = c;
        });
    });

    $('btn-apply-anim').addEventListener('click', () => {
        try {
            const existing = _selectionAncestorWithClass('animated-color');
            if (existing) {
                // Re-applying to already-animated text updates it in place
                // instead of nesting a second wrapper around it.
                existing.style.setProperty('--color1', animColor1.value);
                existing.style.setProperty('--color2', animColor2.value);
                existing.style.setProperty('--anim-duration', animSpeed.value + 's');
                editor.focus();
                syncActiveTabContent(editor);
                return;
            }

            const applied = wrapSelection('animated-color', {
                '--color1'       : animColor1.value,
                '--color2'       : animColor2.value,
                '--anim-duration': animSpeed.value + 's',
            });
            if (!applied) { editor.focus(); return; }
            editor.focus();
            syncActiveTabContent(editor);
        } catch (e) {
            console.error(e);
            alert('No se pudo aplicar animación. Intenta evitar cruzar saltos de línea largos.');
            editor.focus();
        }
    });
}
