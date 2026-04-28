// ── PDF Export ────────────────────────────────────────────────────────────────
// Paged mode: renders each .editor-page DOM element independently as its own
// canvas, then assembles one PDF page per editor page. Perfect alignment.
// Continuous mode: renders the single editor div as one PDF page.

import { $ } from '/js/utils/dom.js';
import { state } from '/js/state.js';
import { PDF_W_IN, PDF_H_IN, PDF_SCALE } from '/js/config.js';

export function initPdfExport(editor) {
    const btn = $('btn-export-pdf');
    if (btn) {
        btn.onclick = async () => {
            console.log('PDF Export: Button clicked');
            try {
                await _exportPDF(editor);
            } catch (err) {
                console.error('PDF Export failed:', err);
                alert('Error al exportar PDF. Revisa la consola para más detalles.');
            }
        };
    }
}

async function _exportPDF(editor) {
    if (typeof window.html2canvas === 'undefined') {
        alert('html2canvas no se ha cargado. Comprueba la conexión a internet.');
        return;
    }

    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JsPDF) { alert('jsPDF no está disponible.'); return; }

    const activeDoc = state.documents.find(d => d.id === state.activeTabId);
    const filename  = (activeDoc?.title || 'Documento') + '.pdf';

    console.log('PDF Export: Capturing pages...');
    const pages = Array.from(document.querySelectorAll('.editor-page'));
    if (!pages.length) { alert('No hay páginas para exportar.'); return; }

    // Letter size: 8.5 x 11 inches at 96 DPI = 816 x 1056 px
    const PAGE_W_PX = 816;
    const PAGE_H_PX = 1056;
    const pdfW_in   = PDF_W_IN;   // 8.5
    const pdfH_in   = PDF_H_IN;   // 11

    const pdf = new JsPDF({ unit: 'in', format: [pdfW_in, pdfH_in], orientation: 'portrait' });

    for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage([pdfW_in, pdfH_in], 'portrait');

        // Temporarily fix page size and hide overflow to avoid clipping
        const page = pages[i];
        const prevOverflow = page.style.overflow;
        const prevWidth    = page.style.width;
        const prevHeight   = page.style.height;
        page.style.overflow = 'hidden';
        page.style.width    = PAGE_W_PX + 'px';
        page.style.height   = PAGE_H_PX + 'px';

        const canvas = await _captureElement(page, PAGE_W_PX, PAGE_H_PX);

        // Restore styles
        page.style.overflow = prevOverflow;
        page.style.width    = prevWidth;
        page.style.height   = prevHeight;

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, pdfW_in, pdfH_in);
    }

    pdf.save(filename);
    console.log('PDF Export: Completed');
}

// ── Capture one DOM element as a canvas (resolving CSS vars inline first) ─────
async function _captureElement(el, w, h) {
    const cs  = getComputedStyle(el);
    const bg  = cs.backgroundColor;
    const col = cs.color;

    const captureW = w || el.offsetWidth;
    const captureH = h || el.offsetHeight;

    // Save & force inline styles so html2canvas sees resolved values
    const prevBg  = el.style.backgroundColor;
    const prevCol = el.style.color;
    el.style.backgroundColor = bg;
    el.style.color           = col;

    const allEls    = Array.from(el.querySelectorAll('*'));
    const savedElStyles = allEls.map(child => {
        const ccs  = getComputedStyle(child);
        const s    = { child, bg: child.style.backgroundColor, color: child.style.color };
        const cbg  = ccs.backgroundColor;
        if (cbg && cbg !== 'rgba(0, 0, 0, 0)' && cbg !== 'transparent') {
            child.style.backgroundColor = cbg;
        }
        child.style.color = ccs.color;
        return s;
    });

    let canvas;
    try {
        canvas = await window.html2canvas(el, {
            scale:           PDF_SCALE,
            useCORS:         true,
            backgroundColor: bg,
            logging:         false,
            width:           captureW,
            height:          captureH,
            windowWidth:     captureW,
            windowHeight:    captureH,
        });
    } finally {
        el.style.backgroundColor = prevBg;
        el.style.color           = prevCol;
        savedElStyles.forEach(({ child, bg: b, color }) => {
            child.style.backgroundColor = b;
            child.style.color           = color;
        });
    }
    return canvas;
}
