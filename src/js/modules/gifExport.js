// ── GIF Export (animated color effects) ──────────────────────────────────────
// Exports the current page as an animated GIF. A PDF can only ever capture a
// single static frame, so .animated-color ("Chroma Morph") text — which
// cycles between two colors via the chroma-morph CSS animation in style.css —
// is invisible there. This captures several frames across one full animation
// cycle and re-encodes them as a looping GIF instead.

import { $ } from '/js/utils/dom.js';
import { state } from '/js/state.js';
import { PAGE_WIDTH, PAGE_HEIGHT, GIF_SCALE, GIF_FPS, GIF_MIN_FRAMES, GIF_MAX_FRAMES } from '/js/config.js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { captureElement } from './pdfExport.js';

export function initGifExport() {
    const btn = $('btn-export-gif');
    if (!btn) return;

    const originalLabel = btn.innerHTML;
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Generando GIF...';
        try {
            await _exportGIF();
        } catch (err) {
            console.error('GIF Export failed:', err);
            alert('Error al exportar GIF. Revisa la consola para más detalles.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalLabel;
        }
    });
}

/** The page containing the current caret/focus, falling back to the first page. */
function _currentPage() {
    const active = document.activeElement;
    const focused = active?.closest?.('.page-content')?.closest('.editor-page');
    return focused || document.querySelector('.editor-page');
}

async function _exportGIF() {
    const page = _currentPage();
    if (!page) { alert('No hay ninguna página para exportar.'); return; }

    const animated = Array.from(page.querySelectorAll('.animated-color'));
    if (!animated.length) {
        alert('Esta página no tiene texto con animación de color. Selecciona texto y usa "Aplicar Animación al Texto" primero.');
        return;
    }

    // Each animated span keeps its own colors/speed (set independently via
    // the Chroma Morph tool); the GIF loops for as long as the slowest one
    // takes, so every animation on the page completes at least one full cycle.
    const spans = animated.map(el => {
        const cs = getComputedStyle(el);
        return {
            el,
            color1  : cs.getPropertyValue('--color1').trim() || '#ffffff',
            color2  : cs.getPropertyValue('--color2').trim() || '#000000',
            duration: parseFloat(cs.getPropertyValue('--anim-duration')) || 1,
        };
    });
    const totalDuration = Math.max(...spans.map(s => s.duration));
    const frameCount = Math.min(GIF_MAX_FRAMES, Math.max(GIF_MIN_FRAMES, Math.round(totalDuration * GIF_FPS)));
    const delayMs = Math.round((totalDuration * 1000) / frameCount);

    const gif = GIFEncoder();

    try {
        for (let i = 0; i < frameCount; i++) {
            const tGlobal = (i / frameCount) * totalDuration;
            // Disable each span's CSS animation and pin its color for this
            // frame — a running @keyframes animation always overrides an
            // inline color, so it has to be turned off to control the exact
            // shade html2canvas will see.
            spans.forEach(s => {
                const localT = (tGlobal % s.duration) / s.duration;
                s.el.style.setProperty('animation', 'none');
                s.el.style.setProperty('color', _chromaColorAt(s.color1, s.color2, localT));
            });

            const canvas = await captureElement(page, PAGE_WIDTH, PAGE_HEIGHT, GIF_SCALE);
            const ctx = canvas.getContext('2d');
            const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const palette = quantize(data, 256);
            const indexed = applyPalette(data, palette);
            gif.writeFrame(indexed, width, height, { palette, delay: delayMs, repeat: 0 });
        }
    } finally {
        // Restore live animations regardless of success/failure.
        spans.forEach(s => {
            s.el.style.removeProperty('animation');
            s.el.style.removeProperty('color');
        });
    }

    gif.finish();

    const activeDoc = state.documents.find(d => d.id === state.activeTabId);
    const filename  = (activeDoc?.title || 'Documento') + '.gif';

    await _saveGif(gif.bytes(), filename);
}

// ── Save the generated GIF, using a native save dialog when running in Tauri ──
// Mirrors pdfExport.js's _savePdf: a plain <a download> click saves silently
// to Downloads with no dialog or confirmation of where the file went when
// running inside the Tauri webview, unlike a real browser.
async function _saveGif(bytes, filename) {
    if (window.__TAURI__ && window.__TAURI__.dialog) {
        const { save } = window.__TAURI__.dialog;
        const { writeFile } = window.__TAURI__.fs;
        const path = await save({
            filters: [{ name: 'GIF Image', extensions: ['gif'] }],
            defaultPath: filename,
        });
        if (!path) return; // user cancelled the dialog
        await writeFile(path, bytes);
        alert('GIF exportado en:\n' + path);
        return;
    }

    const blob = new Blob([bytes], { type: 'image/gif' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Mirrors the @keyframes chroma-morph rule in style.css:
 *  0% -> color1, 50% -> color2, 100% -> color1. */
function _chromaColorAt(color1, color2, t) {
    return t < 0.5
        ? _lerpColor(color1, color2, t * 2)
        : _lerpColor(color2, color1, (t - 0.5) * 2);
}

function _lerpColor(from, to, t) {
    const [r1, g1, b1] = _parseColor(from);
    const [r2, g2, b2] = _parseColor(to);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

let _colorParseCtx = null;

/** Uses the browser's own color parser (via canvas fillStyle normalization)
 *  instead of hand-rolling hex/rgb/named-color parsing. */
function _parseColor(color) {
    _colorParseCtx = _colorParseCtx || document.createElement('canvas').getContext('2d');
    _colorParseCtx.fillStyle = '#000000';
    _colorParseCtx.fillStyle = color;
    const normalized = _colorParseCtx.fillStyle;

    const hex = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];

    const rgb = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];

    return [255, 255, 255];
}
