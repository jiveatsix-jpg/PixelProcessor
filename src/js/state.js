// ── Application State ─────────────────────────────────────────────────────────
// Single source of truth. All modules read from / write to this object.
// No reactivity framework — modules call each other's update functions
// explicitly after modifying state.

import { DEFAULT_PALETTE, LS_KEYS } from './config.js';

export const state = {
    /** @type {{ id: string, title: string, content: string }[]} */
    documents  : [],
    activeTabId: null,
    isPagedMode: true,
    currentPalette: [...DEFAULT_PALETTE],
};

// ── Persistence helpers ───────────────────────────────────────────────────────

export function loadStateFromStorage() {
    // Documents
    try {
        const raw = localStorage.getItem(LS_KEYS.DOCUMENTS);
        if (raw) state.documents = JSON.parse(raw);
    } catch { state.documents = []; }

    // Legacy migration from old single-document format
    const legacy = localStorage.getItem(LS_KEYS.OLD_CONTENT);
    if (legacy && state.documents.length === 0) {
        state.documents = [{ id: Date.now().toString(), title: 'Document 1', content: legacy }];
        localStorage.removeItem(LS_KEYS.OLD_CONTENT);
    }

    if (state.documents.length === 0) {
        state.documents = [{ id: Date.now().toString(), title: 'Document 1', content: '<p></p>' }];
    }

    state.activeTabId = state.documents[0].id;

    // Palette
    try {
        const pal = localStorage.getItem(LS_KEYS.PALETTE);
        if (pal) state.currentPalette = JSON.parse(pal);
    } catch { /* keep default */ }

    // Page mode is now forced to true
    state.isPagedMode = true;
}

export function saveDocumentsToStorage() {
    localStorage.setItem(LS_KEYS.DOCUMENTS, JSON.stringify(state.documents));
}

export function savePaletteToStorage() {
    localStorage.setItem(LS_KEYS.PALETTE, JSON.stringify(state.currentPalette));
}

/** Register a function that returns the current raw text (used by pageMode) */
let _rawTextGetter = null;
export function registerRawTextGetter(fn) { _rawTextGetter = fn; }

/** Updates the in-memory content of the active tab from the live editor DOM */
export function syncActiveTabContent(editor) {
    const doc = state.documents.find(d => d.id === state.activeTabId);
    if (!doc) return;

    if (state.isPagedMode && _rawTextGetter) {
        doc.content = _rawTextGetter();
    } else {
        doc.content = editor.innerHTML;
    }
}
