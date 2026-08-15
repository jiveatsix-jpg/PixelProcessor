// ── Headless Import/Export ────────────────────────────────────────────────────
// When the compiled app is launched with `--import <file.pxp>`, the Rust side
// stashes the file contents + export dir and exposes them via the
// `get_headless_import` command. On a normal interactive launch that command
// returns null and this module is a complete no-op.
//
// Headless flow: inject the document, wait for layout to settle, build the
// PDF the same way the export button does, then hand the bytes to Rust to
// write to disk and exit the process — no dialogs, no clicks.

import { injectDocument } from './tabs.js';
import { buildPdfFromCurrentPages } from './pdfExport.js';

export async function initHeadless() {
    if (!window.__TAURI__) return; // plain browser dev mode — nothing to do

    const { invoke } = window.__TAURI__.core;
    const headless = await invoke('get_headless_import');
    if (!headless) return; // normal interactive launch — no --import flag

    try {
        const { title, content } = JSON.parse(headless.pxp_json);
        injectDocument(title, content);

        // Same signal pageMode.js already uses to avoid measuring against
        // fallback web-font metrics before the pixel-art font has loaded.
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        // Let the reflow that fonts.ready triggers (see pageMode.js) actually
        // paint before capturing.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const pdf = await buildPdfFromCurrentPages();
        if (!pdf) throw new Error('Headless export: no pages to export.');

        const timestamp = _formatTimestamp(new Date());
        const filename  = `PixelNews_${timestamp}.pdf`;
        const data       = Array.from(new Uint8Array(pdf.output('arraybuffer')));

        const writtenPath = await invoke('save_pdf_and_exit', {
            dir: headless.export_dir,
            filename,
            data,
        });
        console.log('Headless: PDF exported to', writtenPath);
    } catch (err) {
        console.error('Headless export failed:', err);
    }
}

function _formatTimestamp(d) {
    const pad = n => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    return `${date}_${time}`;
}
