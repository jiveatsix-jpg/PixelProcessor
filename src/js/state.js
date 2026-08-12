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
        if (raw) {
            const parsed = JSON.parse(raw);
            _state.documents = Array.isArray(parsed) ? parsed : [];
        }
    } catch { _state.documents = []; }

    // Legacy migration
    const legacy = localStorage.getItem(LS_KEYS.OLD_CONTENT);
    if (legacy && _state.documents.length === 0) {
        _state.documents = [{ id: genId(), title: 'Document 1', content: legacy }];
        localStorage.removeItem(LS_KEYS.OLD_CONTENT);
    }

    if (_state.documents.length === 0) {
        _state.documents = [{ id: genId(), title: 'Document 1', type: 'word', content: '<p></p>' }];
    }

    // Ensure legacy docs get a type
    _state.documents.forEach(d => {
        if (!d.type) d.type = 'word';
        if (d.type === 'grid' && d.grid && !d.grid.fontFamily) {
            d.grid.fontFamily = "'Press Start 2P', monospace";
        }
    });

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
    try {
        localStorage.setItem(LS_KEYS.DOCUMENTS, JSON.stringify(_state.documents));
    } catch (e) {
        console.error('Failed to save documents:', e);
        alert('No se pudo guardar el documento (almacenamiento lleno o no disponible). Si tienes imágenes grandes, prueba a reducirlas o eliminarlas.');
    }
}

export function savePaletteToStorage() {
    try {
        localStorage.setItem(LS_KEYS.PALETTE, JSON.stringify(_state.currentPalette));
    } catch (e) {
        console.error('Failed to save palette:', e);
    }
}

// ── Saved Palettes (named) ──────────────────────────────────────────────────

/** Load all named palettes from storage. Returns { name: ['#hex', ...] } */
export function loadSavedPalettes() {
    try {
        const raw = localStorage.getItem(LS_KEYS.SAVED_PALETTES);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

/** Save a named palette (upsert). */
export function savePalette(name, colors) {
    const palettes = loadSavedPalettes();
    palettes[name] = [...colors];
    try {
        localStorage.setItem(LS_KEYS.SAVED_PALETTES, JSON.stringify(palettes));
    } catch (e) {
        console.error('Failed to save named palette:', e);
    }
}

/** Delete a named palette. */
export function deleteSavedPalette(name) {
    const palettes = loadSavedPalettes();
    delete palettes[name];
    try {
        localStorage.setItem(LS_KEYS.SAVED_PALETTES, JSON.stringify(palettes));
    } catch (e) {
        console.error('Failed to delete named palette:', e);
    }
}

// ── Content sync ──────────────────────────────────────────────────────────────

let _rawTextGetter = null;
export function registerRawTextGetter(fn) { _rawTextGetter = fn; }

export function syncActiveTabContent(editor) {
    const doc = _state.documents.find(d => d.id === _state.activeTabId);
    if (!doc) return;

    if (doc.type === 'grid') {
        // Grid content is synced directly by the grid module
        return;
    }

    if (_state.isPagedMode && _rawTextGetter) {
        doc.content = _rawTextGetter();
    } else {
        doc.content = editor.innerHTML;
    }
    _notify('documents', _state.documents, null);
}

// ── ID generation ──────────────────────────────────────────────────────────────

/** Generate a unique document id (Date.now() alone can collide within the same ms). */
export function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ── Backwards compatibility: export state object for modules that read directly ─
// Modules can still read `state.documents` directly, but mutations should
// go through `set()` / `mutate()` for reactivity.
export { _state as state };
