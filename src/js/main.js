// ── PixelProcessor — Entry Point ──────────────────────────────────────────────
// Initializes all modules in dependency order.

import { loadStateFromStorage } from './state.js';
import { initTabs, initDocumentButtons } from './modules/tabs.js';
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
});
