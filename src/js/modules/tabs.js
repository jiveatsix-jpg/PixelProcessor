// ── Tab / Document Manager ────────────────────────────────────────────────────

import { state, syncActiveTabContent, saveDocumentsToStorage } from '/js/state.js';
import { $, on } from '/js/utils/dom.js';
import { renderPages } from '/js/modules/pageMode.js';
import { renderGrid } from '/js/modules/grid/index.js';

let _editor   = null;
let _tabsBar  = null;

export function initTabs(editor) {
    _editor  = editor;
    _tabsBar = $('tabs-bar');

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

    on(editor, 'input', () => syncActiveTabContent(_editor));

    loadActiveTab();
}

export function renderTabs() {
    _tabsBar.innerHTML = '';
    state.documents.forEach(doc => {
        const tabEl   = document.createElement('div');
        tabEl.className  = 'tab ' + (doc.id === state.activeTabId ? 'active' : '');
        tabEl.dataset.id = doc.id;

        const icon = document.createElement('span');
        icon.className = 'tab-icon';
        icon.textContent = doc.type === 'grid' ? '▦' : 'W';

        const title = document.createElement('span');
        title.className   = 'tab-title';
        title.textContent = doc.title;

        const close = document.createElement('span');
        close.className   = 'tab-close';
        close.textContent = 'x';
        close.title       = 'Close Document';

        tabEl.appendChild(icon);
        tabEl.appendChild(title);
        tabEl.appendChild(close);
        _tabsBar.appendChild(tabEl);
    });
}

export function loadActiveTab() {
    const doc = state.documents.find(d => d.id === state.activeTabId);
    if (!doc) return;
    renderTabs();

    // Show/hide editor areas based on type
    const editorArea = document.getElementById('editor-container');
    const gridArea   = document.getElementById('grid-area');
    const gridToolbar = document.getElementById('grid-toolbar-group');

    if (doc.type === 'grid') {
        editorArea.style.display = 'none';
        gridArea.style.display   = '';
        if (gridToolbar) gridToolbar.style.display = '';
        renderGrid(doc);
    } else {
        editorArea.style.display = '';
        gridArea.style.display   = 'none';
        if (gridToolbar) gridToolbar.style.display = 'none';

        if (state.isPagedMode) {
            renderPages(doc.content || '');
        } else {
            _editor.innerHTML = doc.content || '<p></p>';
        }
    }
}

export function newDocument() {
    syncActiveTabContent(_editor);
    const newId = Date.now().toString();
    state.documents.push({
        id     : newId,
        title  : `Document ${state.documents.length + 1}`,
        type   : 'word',
        content: '<p></p>',
    });
    state.activeTabId = newId;
    loadActiveTab();
}

export function newGridDocument() {
    syncActiveTabContent(_editor);
    const newId = Date.now().toString();
    state.documents.push({
        id    : newId,
        title : `Sheet ${state.documents.filter(d => d.type === 'grid').length + 1}`,
        type  : 'grid',
        grid  : {
            fontFamily: "'VT323', monospace",
            headers: ['Columna A', 'Columna B', 'Columna C'],
            rows: [['', '', '']],
            columns: [
                { type: 'text' },
                { type: 'text' },
                { type: 'text' },
            ],
        },
    });
    state.activeTabId = newId;
    loadActiveTab();
}

export function injectDocument(title, content) {
    syncActiveTabContent(_editor);
    const newId = Date.now().toString();
    state.documents.push({ id: newId, title, type: 'word', content });
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
        state.documents = [{ id: Date.now().toString(), title: 'Document 1', type: 'word', content: '<p></p>' }];
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

export function initDocumentButtons(editor) {
    _editor = editor;
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
