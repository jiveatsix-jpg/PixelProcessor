// ── Visual Effects: Glow & Chroma Morph ──────────────────────────────────────

import { $, $q, wrapSelection, unwrapElement } from '../utils/dom.js';
import { openColorPicker } from './colorPicker.js';
import { syncActiveTabContent } from '../state.js';
import { LS_KEYS } from '../config.js';

export function initEffects(editor) {
    _initGlow(editor);
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

// ── Neon Glow ─────────────────────────────────────────────────────────────────

function _initGlow(editor) {
    const glowColorInput     = $('glow-color-input');
    const glowColorIndicator = $('glow-color-indicator');

    const saved = localStorage.getItem(LS_KEYS.GLOW_COLOR) || '#ffffff';
    glowColorInput.value                    = saved;
    glowColorIndicator.style.backgroundColor = saved;

    $('btn-glow-toggle').addEventListener('click', () => {
        try {
            const existing = _selectionAncestorWithClass('neon-glow');

            if (existing) {
                const currentColor = getComputedStyle(existing).getPropertyValue('--glow-color').trim();
                if (currentColor.toLowerCase() === glowColorInput.value.toLowerCase()) {
                    // Same color pressed again on already-glowing text -> remove it.
                    unwrapElement(existing);
                } else {
                    // A different color was picked -> update this highlight in place
                    // instead of nesting a second wrapper around it.
                    existing.style.setProperty('--glow-color', glowColorInput.value);
                }
                editor.focus();
                syncActiveTabContent(editor);
                return;
            }

            const applied = wrapSelection('neon-glow', {
                '--glow-color': glowColorInput.value,
            });
            if (!applied) { editor.focus(); return; }
            editor.focus();
            syncActiveTabContent(editor);
        } catch (e) {
            console.error(e);
            alert('No se pudo aplicar el brillo. Intenta evitar cruzar saltos de línea largos.');
            editor.focus();
        }
    });

    $q('[data-target="glow-color-input"]').addEventListener('click', () => {
        openColorPicker(glowColorInput.value, 'Color del Brillo', (hex) => {
            glowColorInput.value                    = hex;
            glowColorIndicator.style.backgroundColor = hex;
            localStorage.setItem(LS_KEYS.GLOW_COLOR, hex);
        });
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
