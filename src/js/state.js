// ── Application State (Reactive Observer Pattern) ─────────────────────────────
// Single source of truth with pub/sub for state changes.
// Modules subscribe to specific keys and are notified on change.

import { DEFAULT_PALETTE, LS_KEYS } from './config.js';

const _listeners = new Map(); // key → Set<callback>

const _state = {
    documents   : [],
    activeTabId : null,
    isPagedMode : true,
    currentPalette: [...DEFAULT_PALETTE],
};

/** Get a shallow clone of state (read-only snapshot). */
export function getState() { return { ..._state }; }

/** Get a specific state property. */
export function get(key) { return _state[key]; }

/** Set a state property and notify listeners. */
export function set(key, value) {
    const prev = _state[key];
    _state[key] = value;
    _notify(key, value, prev);
}

/** Mutate a nested property (e.g. push to documents array). */
export function mutate(key, fn) {
    fn(_state[key]);
    _notify(key, _state[key], null);
}

/** Subscribe to changes on a specific state key. */
export function subscribe(key, callback) {
    if (!_listeners.has(key)) {
        _listeners.set(key, new Set());
    }
    _listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
        _listeners.get(key)?.delete(callback);
    };
}

/** Notify all listeners for a key. */
function _notify(key, value, prev) {
    _listeners.get(key)?.forEach(cb => cb(value, prev));
}

// ── Persistence helpers ───────────────────────────────────────────────────────

export function loadStateFromStorage() {
    // Documents
    try {
        const raw = localStorage.getItem(LS_KEYS.DOCUMENTS);
        if (raw) _state.documents = JSON.parse(raw);
    } catch { _state.documents = []; }

    // Legacy migration
    const legacy = localStorage.getItem(LS_KEYS.OLD_CONTENT);
    if (legacy && _state.documents.length === 0) {
        _state.documents = [{ id: Date.now().toString(), title: 'Document 1', content: legacy }];
        localStorage.removeItem(LS_KEYS.OLD_CONTENT);
    }

    if (_state.documents.length === 0) {
        _state.documents = [{ id: Date.now().toString(), title: 'Document 1', content: '<p></p>' }];
    }

    _state.activeTabId = _state.documents[0].id;

    // Palette
    try {
        const pal = localStorage.getItem(LS_KEYS.PALETTE);
        if (pal) _state.currentPalette = JSON.parse(pal);
    } catch { /* keep default */ }

    _state.isPagedMode = true;
    _notify('all', _state, null);
}

export function saveDocumentsToStorage() {
    localStorage.setItem(LS_KEYS.DOCUMENTS, JSON.stringify(_state.documents));
}

export function savePaletteToStorage() {
    localStorage.setItem(LS_KEYS.PALETTE, JSON.stringify(_state.currentPalette));
}

// ── Content sync ──────────────────────────────────────────────────────────────

let _rawTextGetter = null;
export function registerRawTextGetter(fn) { _rawTextGetter = fn; }

export function syncActiveTabContent(editor) {
    const doc = _state.documents.find(d => d.id === _state.activeTabId);
    if (!doc) return;

    if (_state.isPagedMode && _rawTextGetter) {
        doc.content = _rawTextGetter();
    } else {
        doc.content = editor.innerHTML;
    }
    _notify('documents', _state.documents, null);
}

// ── Backwards compatibility: export state object for modules that read directly ─
// Modules can still read `state.documents` directly, but mutations should
// go through `set()` / `mutate()` for reactivity.
export { _state as state };
