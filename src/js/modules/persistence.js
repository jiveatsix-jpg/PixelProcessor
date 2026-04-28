// ── Persistence: localStorage, PXP, TXT Export ───────────────────────────────

import { $ } from '/js/utils/dom.js';
import { downloadText } from '/js/utils/dom.js';
import { state, syncActiveTabContent, saveDocumentsToStorage } from '/js/state.js';
import { injectDocument } from '/js/modules/tabs.js';
import { getRawText } from '/js/modules/pageMode.js';

export function initPersistence(editor) {
    console.log('Persistence: Initializing event listeners...');

    // ── Save as .PXP ──────────────────────────────────────────────────────────────
    const btnSavePxp = $('btn-save-pxp');
    if (btnSavePxp) {
        btnSavePxp.onclick = () => {
            console.log('Persistence: Save PXP clicked');
            syncActiveTabContent(editor);
            const doc = state.documents.find(d => d.id === state.activeTabId);
            if (!doc) return;

            const content = getRawText ? getRawText() : doc.content;
            const json = JSON.stringify({ title: doc.title, content: content });

            if (window.__TAURI__ && window.__TAURI__.dialog) {
                _saveTauriPXP(doc.title, json);
            } else {
                console.log('Persistence: Browser download fallback for PXP');
                downloadText(doc.title + '.pxp', json, 'application/json');
            }
        };
    }

    // ── Open .PXP ────────────────────────────────────────────────────────────────
    const btnOpen = $('btn-open-file');
    const pxpUpload = $('pxp-upload');
    if (btnOpen && pxpUpload) {
        btnOpen.onclick = () => {
            console.log('Persistence: Open PXP clicked');
            if (window.__TAURI__ && window.__TAURI__.dialog) {
                _openTauriPXP();
            } else {
                pxpUpload.click();
            }
        };

        pxpUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => _loadPXP(ev.target.result);
            reader.readAsText(file);
            e.target.value = '';
        };
    }

    // ── Import .TXT ───────────────────────────────────────────────────────────────
    const btnImportTxt = $('btn-import-txt');
    const txtUpload = $('txt-upload');
    if (btnImportTxt && txtUpload) {
        btnImportTxt.onclick = () => {
            console.log('Persistence: Import TXT clicked');
            if (window.__TAURI__ && window.__TAURI__.dialog) {
                _openTauriTXT();
            } else {
                txtUpload.click();
            }
        };

        txtUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => _loadTXT(file.name, ev.target.result);
            reader.readAsText(file);
            e.target.value = '';
        };
    }

    // ── Export as .TXT ────────────────────────────────────────────────────────────
    const btnExport = $('btn-export');
    if (btnExport) {
        btnExport.onclick = () => {
            console.log('Persistence: Export TXT clicked');
            const text = getRawText ? getRawText() : '';
            if (window.__TAURI__ && window.__TAURI__.dialog) {
                _saveTauriTXT(text);
            } else {
                downloadText('pixel_document.txt', text);
            }
        };
    }
}

async function _saveTauriPXP(title, json) {
    try {
        const { save } = window.__TAURI__.dialog;
        const { writeTextFile } = window.__TAURI__.fs;
        const path = await save({
            filters: [{ name: 'Pixel Processor Document', extensions: ['pxp'] }],
            defaultPath: title + '.pxp',
        });
        if (path) await writeTextFile(path, json);
    } catch (e) {
        console.error('Tauri PXP save error', e);
        alert('Error guardando PXP en Tauri. Reintentando descarga de navegador.');
        const data = JSON.parse(json);
        downloadText(data.title + '.pxp', json, 'application/json');
    }
}

async function _openTauriPXP() {
    try {
        const { open } = window.__TAURI__.dialog;
        const { readTextFile } = window.__TAURI__.fs;
        const path = await open({
            multiple: false,
            filters: [{ name: 'Pixel Processor Document', extensions: ['pxp'] }],
        });
        if (path) _loadPXP(await readTextFile(path));
    } catch (e) {
        console.error('Tauri PXP open error', e);
    }
}

async function _saveTauriTXT(text) {
    try {
        const { save } = window.__TAURI__.dialog;
        const { writeTextFile } = window.__TAURI__.fs;
        const path = await save({
            filters: [{ name: 'Text Document', extensions: ['txt'] }],
            defaultPath: 'pixel_document.txt',
        });
        if (path) await writeTextFile(path, text);
    } catch (e) {
        console.error('Tauri TXT export error', e);
        downloadText('pixel_document.txt', text);
    }
}

async function _openTauriTXT() {
    try {
        const { open } = window.__TAURI__.dialog;
        const { readTextFile } = window.__TAURI__.fs;
        const path = await open({
            multiple: false,
            filters: [{ name: 'Text Document', extensions: ['txt'] }],
        });
        if (path) {
            const text = await readTextFile(path);
            const filename = path.split('/').pop().split('\\').pop().replace('.txt', '');
            _loadTXT(filename, text);
        }
    } catch (e) {
        console.error('Tauri TXT open error', e);
    }
}

function _loadTXT(filename, text) {
    try {
        injectDocument(filename, text);
    } catch (e) {
        console.error('TXT load error', e);
        alert('Error al importar archivo TXT.');
    }
}

function _loadPXP(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data && data.title && data.content !== undefined) {
            injectDocument(data.title, data.content);
        }
    } catch (e) {
        console.error('PXP parse error', e);
        alert('Error al abrir archivo PXP.');
    }
}

// ── DOM → ASCII (for TXT export) ─────────────────────────────────────────────

function _domToASCII(node) {
    let text = '';
    for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();
            if      (tag === 'br')              text += '\n';
            else if (tag === 'p' || tag === 'div') text += _domToASCII(child) + '\n';
            else if (tag === 'table')           text += '\n' + _tableToASCII(child) + '\n';
            else if (tag === 'img')             text += '\n[Imagen local]\n';
            else                                text += _domToASCII(child);
        }
    }
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

function _tableToASCII(table) {
    const rows      = Array.from(table.rows);
    if (!rows.length) return '';
    const colWidths = [];
    rows.forEach(row => {
        Array.from(row.cells).forEach((cell, i) => {
            colWidths[i] = Math.max(colWidths[i] || 3, cell.innerText.trim().length);
        });
    });
    const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    let ascii = sep + '\n';
    rows.forEach(row => {
        const isHeader = row.cells[0]?.tagName.toLowerCase() === 'th';
        let rowStr = '|';
        Array.from(row.cells).forEach((cell, i) => {
            rowStr += ' ' + cell.innerText.trim().padEnd(colWidths[i]) + ' |';
        });
        ascii += rowStr + '\n';
        if (isHeader) ascii += sep + '\n';
    });
    if (rows.length && rows[rows.length - 1].cells[0]?.tagName.toLowerCase() !== 'th') ascii += sep + '\n';
    return ascii;
}
