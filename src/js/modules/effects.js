// ── Visual Effects: Glow & Chroma Morph ──────────────────────────────────────

import { $, $q, wrapSelection } from '../utils/dom.js';
import { openColorPicker } from './colorPicker.js';
import { syncActiveTabContent } from '../state.js';
import { LS_KEYS } from '../config.js';

export function initEffects(editor) {
    _initGlow(editor);
    _initChromaMorph(editor);
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
            const wrapper = wrapSelection('neon-glow', {
                '--glow-color': glowColorInput.value,
            });
            if (!wrapper) { editor.focus(); return; }
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
            const wrapper = wrapSelection('animated-color', {
                '--color1'       : animColor1.value,
                '--color2'       : animColor2.value,
                '--anim-duration': animSpeed.value + 's',
            });
            if (!wrapper) { editor.focus(); return; }
            editor.focus();
            syncActiveTabContent(editor);
        } catch (e) {
            console.error(e);
            alert('No se pudo aplicar animación. Intenta evitar cruzar saltos de línea largos.');
            editor.focus();
        }
    });
}
