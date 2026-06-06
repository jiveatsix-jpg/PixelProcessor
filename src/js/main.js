// ── PixelProcessor — Entry Point ──────────────────────────────────────────────
// Initializes all modules in dependency order.

import { loadStateFromStorage } from './state.js';
import { initTabs, initDocumentButtons, newGridDocument } from './modules/tabs.js';
import { initFormatting } from './modules/formatting.js';
import { initEffects } from './modules/effects.js';
import { initPageMode } from './modules/pageMode.js';
import { initTable } from './modules/table.js';
import { initImage } from './modules/image.js';
import { initPersistence } from './modules/persistence.js';
import { initPdfExport } from './modules/pdfExport.js';
import { initZoom } from './modules/zoom.js';

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');

    const safeInit = (name, fn) => {
        try {
            fn();
            console.log(`${name} OK`);
        } catch (e) {
            console.error(`${name} ERROR:`, e);
        }
    };

    safeInit('State',       () => loadStateFromStorage());
    safeInit('PageMode',    () => initPageMode(editor));
    safeInit('Tabs',        () => { initTabs(editor); initDocumentButtons(editor); });
    safeInit('Formatting',  () => initFormatting(editor));
    safeInit('Effects',     () => initEffects(editor));
    safeInit('Table',       () => initTable(editor));
    safeInit('Image',       () => initImage(editor));
    safeInit('Persistence', () => initPersistence(editor));
    safeInit('PdfExport',   () => initPdfExport(editor));
    safeInit('Zoom',        () => initZoom(document.getElementById('editor-container')));

    const btnNewGrid = document.getElementById('btn-new-grid');
    if (btnNewGrid) btnNewGrid.addEventListener('click', newGridDocument);

    // ── Reading Mode Logic ──────────────────────────────────────────────────
    const btnReadMode = document.getElementById('btn-read-mode');
    const btnExitReadMode = document.getElementById('btn-exit-read-mode');
    
    if (btnReadMode && btnExitReadMode) {
        const toggleReadMode = (enable) => {
            if (enable) {
                document.body.classList.add('reading-mode');
                editor.setAttribute('contenteditable', 'false');
                document.querySelectorAll('.page-content').forEach(p => p.setAttribute('contenteditable', 'false'));
            } else {
                document.body.classList.remove('reading-mode');
                editor.setAttribute('contenteditable', 'true');
                document.querySelectorAll('.page-content').forEach(p => p.setAttribute('contenteditable', 'true'));
            }
        };

        btnReadMode.addEventListener('click', () => toggleReadMode(true));
        btnExitReadMode.addEventListener('click', () => toggleReadMode(false));
    }
});
