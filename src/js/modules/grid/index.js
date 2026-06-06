import { addRow, addColumn, delRow, delColumn } from '/js/modules/grid/gridEngine.js';
import { parseCSV, toCSV } from '/js/modules/grid/csvIO.js';
import { saveDocumentsToStorage, state } from '/js/state.js';

let _activeDoc = null;
let _area = null;

export function renderGrid(doc) {
    _activeDoc = doc;
    _area = document.getElementById('grid-area');
    if (!_area) return;
    _area.innerHTML = '';

    const g = doc.grid;

    const wrap = document.createElement('div');
    wrap.className = 'grid-table-wrap';

    const table = document.createElement('table');
    table.className = 'grid-table';
    if (g.fontFamily) table.style.fontFamily = g.fontFamily;

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Row number column header
    const rh = document.createElement('th');
    rh.className = 'grid-header grid-row-header';
    rh.textContent = '#';
    headerRow.appendChild(rh);

    g.headers.forEach((h, ci) => {
        const th = document.createElement('th');
        th.className = 'grid-header';
        th.dataset.col = ci;
        th.textContent = h;
        if (g.columns[ci] && g.columns[ci].type === 'category') {
            const badge = document.createElement('span');
            badge.className = 'grid-type-badge';
            badge.textContent = '▼';
            th.appendChild(badge);
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Header rename via double-click
    headerRow.addEventListener('dblclick', (e) => {
        const th = e.target.closest('.grid-header:not(.grid-row-header)');
        if (!th) return;
        startHeaderEdit(th);
    });

    const tbody = document.createElement('tbody');
    g.rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        tr.dataset.row = ri;

        // Row number cell
        const rn = document.createElement('td');
        rn.className = 'grid-cell grid-row-num';
        rn.textContent = ri + 1;
        tr.appendChild(rn);

        row.forEach((cell, ci) => {
            const td = document.createElement('td');
            td.className = 'grid-cell';
            td.dataset.col = ci;
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    _area.appendChild(wrap);

    bindGridEvents();
    bindToolbar();

    // Sync font selector with doc state
    const fontSel = document.getElementById('grid-font-family');
    if (fontSel && g.fontFamily) fontSel.value = g.fontFamily;
}

// ── Header Rename ──────────────────────────────────────────────

function startHeaderEdit(th) {
    const col = parseInt(th.dataset.col);
    const g = _activeDoc.grid;
    const orig = th.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'grid-header-editor';
    input.value = orig;
    th.textContent = '';
    th.appendChild(input);
    input.focus();
    input.select();

    const finish = () => {
        const val = input.value.trim() || orig;
        th.textContent = val;
        g.headers[col] = val;
        saveDocumentsToStorage();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') { th.textContent = orig; }
        e.stopPropagation();
    });
}

// ── Grid Events ────────────────────────────────────────────────

function bindGridEvents() {
    if (!_area) return;

    _area.querySelectorAll('.grid-cell:not(.grid-row-num)').forEach(td => {
        td.addEventListener('dblclick', () => startCellEdit(td));
        td.addEventListener('click', () => {
            commitEditingCell();
            _area.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('active'));
            td.classList.add('active');
            td.setAttribute('tabindex', '-1');
            td.focus();
        });
    });

    _area.addEventListener('keydown', (e) => {
        const editing = _area.querySelector('.grid-cell.editing');
        if (editing) {
            handleEditingKey(e, editing);
            return;
        }
        if (['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            navGrid(e.key);
        }
        if (e.key === 'F2') {
            e.preventDefault();
            const active = _area.querySelector('.grid-cell.active');
            if (active) startCellEdit(active);
        }
    });
}

function handleEditingKey(e, td) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const g = _activeDoc.grid;
        commitCellEdit(td);
        const col = parseInt(td.dataset.col);
        const row = parseInt(td.closest('tr').dataset.row);
        const dir = e.shiftKey ? -1 : 1;
        const numCols = g.headers.length;
        let nextRow = row;
        let nextCol = col + dir;

        if (nextCol < 0) { nextRow--; nextCol = numCols - 1; }
        if (nextCol >= numCols) { nextRow++; nextCol = 0; }

        if (nextRow < 0) return;
        ensureRowExists(nextRow, nextCol);
        navToCell(nextRow, nextCol);
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        commitCellEdit(td);
        const col = parseInt(td.dataset.col);
        const row = parseInt(td.closest('tr').dataset.row);
        const nextRow = row + 1;
        ensureRowExists(nextRow, col);
        navToCell(nextRow, col);
        return;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        cancelCellEdit(td);
        td.classList.add('active');
        td.focus();
        return;
    }
}

function navGrid(key) {
    const active = _area.querySelector('.grid-cell.active') || _area.querySelector('.grid-cell:not(.grid-row-num)');
    if (!active) return;
    let row = parseInt(active.closest('tr').dataset.row);
    let col = parseInt(active.dataset.col);
    if (isNaN(col)) return; // row number cell
    const g = _activeDoc.grid;

    if (key === 'ArrowDown') row++;
    if (key === 'ArrowUp') row = Math.max(0, row - 1);
    if (key === 'ArrowRight') col = Math.min(g.headers.length - 1, col + 1);
    if (key === 'ArrowLeft') col = Math.max(0, col - 1);
    if (key === 'Enter') { row++; }
    if (key === 'Tab') { col++; if (col >= g.headers.length) { col = 0; row++; } }

    ensureRowExists(row, col);
    navToCell(row, col);
}

function navToCell(row, col) {
    const tr = _area.querySelector(`tbody tr[data-row="${row}"]`);
    if (!tr) return;
    const td = tr.querySelector(`td[data-col="${col}"]`);
    if (!td) return;
    _area.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('active'));
    td.classList.add('active');
    td.setAttribute('tabindex', '-1');
    td.focus();
}

function ensureRowExists(rowIdx, colIdx) {
    const g = _activeDoc.grid;
    while (g.rows.length <= rowIdx) {
        addRow(g);
    }
    renderGrid(_activeDoc);
}

function commitEditingCell() {
    if (!_area) return;
    const td = _area.querySelector('.grid-cell.editing');
    if (td) commitCellEdit(td);
}

// ── Cell Editing ───────────────────────────────────────────────

function startCellEdit(td) {
    if (td.classList.contains('grid-row-num')) return;
    commitEditingCell();

    const g = _activeDoc.grid;
    const col = parseInt(td.dataset.col);
    const colDef = g.columns[col];

    const origValue = td.textContent;
    td.dataset.orig = origValue;
    td.classList.add('editing');

    if (colDef && colDef.type === 'category' && colDef.options && colDef.options.length) {
        const sel = document.createElement('select');
        sel.className = 'grid-cell-editor grid-category-editor';
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '';
        sel.appendChild(blank);
        colDef.options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === origValue) o.selected = true;
            sel.appendChild(o);
        });
        td.textContent = '';
        td.appendChild(sel);
        sel.focus();

        sel.addEventListener('change', () => commitCellEdit(td));
        sel.addEventListener('blur', () => commitCellEdit(td));
        sel.addEventListener('keydown', (e) => e.stopPropagation());
    } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'grid-cell-editor';
        input.value = origValue;
        td.textContent = '';
        td.appendChild(input);
        input.focus();
        input.select();

        input.addEventListener('blur', () => commitCellEdit(td));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelCellEdit(td);
                td.focus();
            }
            e.stopPropagation();
        });
    }
}

function commitCellEdit(td) {
    if (!td || !_activeDoc) return;
    const col = parseInt(td.dataset.col);
    if (isNaN(col)) return;
    const input = td.querySelector('input, select');
    const val = input ? input.value : td.textContent;
    td.textContent = val;
    td.classList.remove('editing');
    _activeDoc.grid.rows[parseInt(td.closest('tr').dataset.row)][col] = val;
    saveDocumentsToStorage();
}

function cancelCellEdit(td) {
    const orig = td.dataset.orig || '';
    td.textContent = orig;
    td.classList.remove('editing');
}

// ── Toolbar ────────────────────────────────────────────────────

function bindToolbar() {
    const actions = {
        'btn-grid-add-row': () => {
            if (!_activeDoc) return;
            addRow(_activeDoc.grid);
            renderGrid(_activeDoc);
            saveDocumentsToStorage();
        },
        'btn-grid-add-col': () => {
            if (!_activeDoc) return;
            addColumn(_activeDoc.grid);
            renderGrid(_activeDoc);
            saveDocumentsToStorage();
        },
        'btn-grid-del-row': () => {
            if (!_activeDoc) return;
            delRow(_activeDoc.grid, _activeDoc.grid.rows.length - 1);
            renderGrid(_activeDoc);
            saveDocumentsToStorage();
        },
        'btn-grid-del-col': () => {
            if (!_activeDoc) return;
            delColumn(_activeDoc.grid, _activeDoc.grid.headers.length - 1);
            renderGrid(_activeDoc);
            saveDocumentsToStorage();
        },
        'btn-grid-import-csv': () => {
            document.getElementById('csv-upload').click();
        },
        'btn-grid-export-csv': () => {
            if (!_activeDoc) return;
            const g = _activeDoc.grid;
            const csv = toCSV(g.headers, g.rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = _activeDoc.title.replace(/[^a-z0-9]/gi, '_') + '.csv';
            a.click();
            URL.revokeObjectURL(url);
        },
    };

    Object.entries(actions).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) {
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
            clone.addEventListener('click', fn);
        }
    });

    // Font selector
    const fontSel = document.getElementById('grid-font-family');
    if (fontSel) {
        const handler = () => {
            if (!_activeDoc) return;
            _activeDoc.grid.fontFamily = fontSel.value;
            const table = document.querySelector('.grid-table');
            if (table) table.style.fontFamily = fontSel.value;
            saveDocumentsToStorage();
        };
        fontSel.removeEventListener('change', handler);
        fontSel.addEventListener('change', handler);
    }
}

// ── CSV Upload Handler ─────────────────────────────────────────

document.getElementById('csv-upload')?.addEventListener('change', (e) => {
    if (!_activeDoc) return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const text = reader.result;
        const parsed = parseCSV(text);
        if (!parsed.length) return;
        const csvHeaders = parsed[0];
        const csvRows = parsed.slice(1);
        const g = _activeDoc.grid;
        const colMap = [];
        csvHeaders.forEach(h => {
            const trimmed = h.trim();
            const idx = g.headers.findIndex(ex => ex.toLowerCase() === trimmed.toLowerCase());
            if (idx >= 0) {
                colMap.push(idx);
            } else {
                g.headers.push(trimmed);
                g.columns.push({ type: 'text' });
                g.rows.forEach(r => r.push(''));
                colMap.push(g.headers.length - 1);
            }
        });

        csvRows.forEach(csvRow => {
            const row = new Array(g.headers.length).fill('');
            csvRow.forEach((val, i) => {
                if (i < colMap.length) row[colMap[i]] = val.trim();
            });
            g.rows.push(row);
        });

        renderGrid(_activeDoc);
        saveDocumentsToStorage();
    };
    reader.readAsText(file);
    e.target.value = '';
});
