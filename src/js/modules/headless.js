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
        // A long article can take several reflow passes to finish paginating
        // (pageMode.js's push/pull-back cascades page by page) — two frames
        // is enough for a short test document but not necessarily for a real
        // multi-page article. Poll until the page count stops changing
        // instead of assuming a fixed number of frames is always enough.
        // (A separate, now-fixed CSS bug — missing flex-shrink:0 on
        // .editor-line — was the actual cause of overlapping text in early
        // testing; this wait is a legitimate safety margin regardless.)
        await _waitForPaginationToSettle();

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

/** Waits until the number of `.editor-page` elements (and each page's
 *  scrollHeight) stops changing across consecutive animation frames, up to
 *  a hard cap — pagination reflow can cascade across several frames for a
 *  long article, and capturing mid-cascade produces overlapping text (a
 *  page captured before overflow content was pushed to the next page). */
async function _waitForPaginationToSettle() {
    const STABLE_FRAMES_NEEDED = 3;
    const MAX_FRAMES = 60; // ~1s at 60fps — generous upper bound, never hangs forever

    const snapshot = () => Array.from(document.querySelectorAll('.editor-page')).map(
        page => page.querySelector('.page-content')?.scrollHeight ?? 0
    ).join(',');

    let stableCount = 0;
    let last = snapshot();
    for (let frame = 0; frame < MAX_FRAMES; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const current = snapshot();
        if (current === last) {
            stableCount++;
            if (stableCount >= STABLE_FRAMES_NEEDED) return;
        } else {
            stableCount = 0;
            last = current;
        }
    }
    console.warn('Headless: pagination did not settle within the frame budget, capturing anyway.');
}

function _formatTimestamp(d) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // Milliseconds included so concurrent exports from the same batch (a
    // realistic case — see Pixel News automation) never collide on a
    // second-resolution filename and silently overwrite each other's PDF.
    const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
    return `${date}_${time}`;
}
