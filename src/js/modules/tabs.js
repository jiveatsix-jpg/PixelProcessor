// ── Tab / Document Manager ────────────────────────────────────────────────────

import { state, syncActiveTabContent, saveDocumentsToStorage } from '/js/state.js';
import { $, on } from '/js/utils/dom.js';
import { renderPages } from '/js/modules/pageMode.js';

let _editor  = null;
let _tabsBar = null;

export function initTabs(editor) {
    _editor  = editor;
    _tabsBar = $('tabs-bar');

    // Delegation: single click → switch / close
    on(_tabsBar, 'click', (e) => {
        const tabEl = e.target.closest('.tab');
        if (!tabEl) return;
        const docId = tabEl.dataset.id;

        if (e.target.classList.contains('tab-close')) {
            e.stopPropagation();
            _closeTab(docId);
        } else {
            _switchTab(docId);
        }
    });

    // Double-click → rename
    on(_tabsBar, 'dblclick', (e) => {
        const tabEl = e.target.closest('.tab');
        if (!tabEl) return;
        const doc = state.documents.find(d => d.id === tabEl.dataset.id);
        if (!doc) return;
        const newTitle = prompt('Nuevo nombre del documento:', doc.title);
        if (newTitle && newTitle.trim()) {
            doc.title = newTitle.trim();
            renderTabs();
        }
    });

    // Autosave content on every keystroke
    on(editor, 'input', () => syncActiveTabContent(_editor));

    // Timed save to localStorage (500 ms debounce via main)
    loadActiveTab();
}

export function renderTabs() {
    _tabsBar.innerHTML = '';
    state.documents.forEach(doc => {
        const tabEl   = document.createElement('div');
        tabEl.className  = 'tab ' + (doc.id === state.activeTabId ? 'active' : '');
        tabEl.dataset.id = doc.id;

        const title = document.createElement('span');
        title.className   = 'tab-title';
        title.textContent = doc.title;

        const close = document.createElement('span');
        close.className   = 'tab-close';
        close.textContent = 'x';
        close.title       = 'Close Document';

        tabEl.appendChild(title);
        tabEl.appendChild(close);
        _tabsBar.appendChild(tabEl);
    });
}

export function loadActiveTab() {
    const doc = state.documents.find(d => d.id === state.activeTabId);
    if (doc) {
        if (state.isPagedMode) {
            // Pass the raw content directly to the paged renderer
            // so table HTML is not destroyed by innerText conversion
            renderPages(doc.content || '');
        } else {
            _editor.innerHTML = doc.content || '<p></p>';
        }
    }
    renderTabs();
}

export function newDocument() {
    syncActiveTabContent(_editor);
    const newId = Date.now().toString();
    state.documents.push({
        id     : newId,
        title  : `Document ${state.documents.length + 1}`,
        content: '<p></p>',
    });
    state.activeTabId = newId;
    loadActiveTab();
}

export function injectDocument(title, content) {
    syncActiveTabContent(_editor);
    const newId = Date.now().toString();
    state.documents.push({ id: newId, title, content });
    state.activeTabId = newId;
    loadActiveTab();
}

function _switchTab(docId) {
    syncActiveTabContent(_editor);
    state.activeTabId = docId;
    loadActiveTab();
}

function _closeTab(docId) {
    if (state.documents.length === 1) {
        // Reset to blank instead of removing the last tab
        state.documents = [{ id: Date.now().toString(), title: 'Document 1', content: '<p></p>' }];
        state.activeTabId = state.documents[0].id;
        loadActiveTab();
        return;
    }
    state.documents = state.documents.filter(d => d.id !== docId);
    if (state.activeTabId === docId) {
        state.activeTabId = state.documents[state.documents.length - 1].id;
        loadActiveTab();
    } else {
        renderTabs();
    }
}

// Wire sidebar buttons (called from main)
export function initDocumentButtons(editor) {
    $('btn-new').addEventListener('click', newDocument);

    $('btn-save').addEventListener('click', () => {
        syncActiveTabContent(editor);
        saveDocumentsToStorage();
        const btn = $('btn-save');
        const orig = btn.innerHTML;
        btn.innerHTML = `<svg class="pixel-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 10l-2-2-1 1 3 3 6-6-1-1-5 5z"/></svg> Saved`;
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
    });
}
