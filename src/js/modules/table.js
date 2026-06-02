// ── Table Module ──────────────────────────────────────────────────────────────
// Handles: insert, drag, column resize, add/del row/col, style config modal.

import { $, on } from '../utils/dom.js';
import { openColorPicker } from './colorPicker.js';
import { syncActiveTabContent } from '../state.js';

let _editor = null;

// Shared selection state
let activeTable = null;
let activeRow   = null;
let activeCell  = null;

// Drag state
let isDraggingTable   = false;
let dragStartX        = 0;
let dragStartY        = 0;
let tableInitMarginX  = 0;
let tableInitMarginY  = 0;
let selectedTableNode = null;
let _handle           = null;

// Resize state
let resizingCell       = null;
let resizingStartX     = 0;
let resizingStartWidth = 0;

export function initTable(editor) {
    _editor = editor;

    // Insert Table modal
    const modal = $('table-modal');
    $('btn-table')         .addEventListener('click', () => modal.classList.remove('hidden'));
    $('btn-cancel-table')  .addEventListener('click', () => modal.classList.add('hidden'));
    $('btn-confirm-table') .addEventListener('click', _insertTable);

    // Table context toolbar
    $('btn-add-row').addEventListener('click', _addRow);
    $('btn-add-col').addEventListener('click', _addCol);
    $('btn-del-row').addEventListener('click', _delRow);
    $('btn-del-col').addEventListener('click', _delCol);
    $('btn-del-table').addEventListener('click', _delTable);

    // Drag handle
    _handle = $('table-drag-handle');
    if (_handle) _handle.addEventListener('mousedown', _onHandleMouseDown);

    // Table style config modal
    _initStyleModal();

    // Global events - listen on container to support paged mode
    const container = $('editor-container');
    container.addEventListener('mousemove', _onEditorMouseMove);
    container.addEventListener('mousedown', _onEditorMouseDown);
    document.addEventListener('mousemove', _onDocMouseMove);
    document.addEventListener('mouseup',   _onDocMouseUp);
    document.addEventListener('click',     _onDocClick);
    document.addEventListener('keydown',   _onDocKeyDown);
    container.addEventListener('scroll', _updateHandlePos);

    // Selection tracking
    container.addEventListener('keyup',   checkTableContext);
    container.addEventListener('mouseup', checkTableContext);
    container.addEventListener('click',   checkTableContext);
    container.addEventListener('input',   checkTableContext);
}

// ── Insert Table ──────────────────────────────────────────────────────────────

function _insertTable() {
    const rowsInput = $('table-rows').value;
    const colsInput = $('table-cols').value;
    
    const rows = parseInt(rowsInput, 10) || 1;
    const cols = parseInt(colsInput, 10) || 1;
    
    let html = '<table>';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += r === 0 ? '<th>Header</th>' : '<td>Data</td>';
        }
        html += '</tr>';
    }
    html += '</table>';

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    
    const target = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    const block = target.closest('.editor-line, img, table');
    
    if (block) {
        const container = $('editor-container');
        const allBlocks = Array.from(container.querySelectorAll('.editor-line, img, table'));
        const blockIdx = allBlocks.indexOf(block);
        
        if (blockIdx !== -1) {
            import('./pageMode.js').then(pm => {
                const rawText = pm.getRawText();
                const rawLines = rawText.split('\n');
                
                rawLines.splice(blockIdx + 1, 0, html);
                
                const newContent = rawLines.join('\n');
                _editor.innerText = newContent;
                pm.renderPages();
                
                $('table-modal').classList.add('hidden');
            });
            return;
        }
    }

    let finalTarget = _editor;
    const firstPage = $('editor-container').querySelector('.page-content');
    if (firstPage) finalTarget = firstPage;

    finalTarget.focus();
    document.execCommand('insertHTML', false, html);
    $('table-modal').classList.add('hidden');
    finalTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Context Detection ─────────────────────────────────────────────────────────

export function checkTableContext() {
    const sel  = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const tableTools   = $('table-tools');
    const handle       = $('table-drag-handle');

    const container = $('editor-container');
    if (!container.contains(node)) {
        tableTools.style.display  = 'none';
        handle.style.display      = 'none';
        activeTable = null;
        return;
    }

    const cell = node.closest?.('td, th');
    if (cell && container.contains(cell)) {
        activeCell  = cell;
        activeRow   = cell.closest('tr');
        activeTable = cell.closest('table');
        $('table-tools').style.display = 'flex';
        _updateHandlePos();
    } else {
        $('table-tools').style.display = 'none';
        if (_handle) _handle.style.display = 'none';
        activeTable = null;
    }
}

// ── Handle Position ───────────────────────────────────────────────────────────

function _updateHandlePos() {
    if (!activeTable || !_handle) return;
    const parent = activeTable.offsetParent || document.body;
    
    if (_handle.parentNode !== parent) {
        parent.appendChild(_handle);
    }
    
    _handle.style.top   = (activeTable.offsetTop - 24) + 'px';
    _handle.style.left  = (activeTable.offsetLeft - 24) + 'px';
    _handle.style.display = 'flex';
}

// ── Drag ──────────────────────────────────────────────────────────────────────

function _onHandleMouseDown(e) {
    if (!activeTable) return;
    isDraggingTable = true;
    dragStartX      = e.clientX;
    dragStartY      = e.clientY;

    if (activeTable.style.position !== 'absolute') {
        _makeFloating(activeTable);
    }

    tableInitMarginX = parseFloat(activeTable.style.left) || 0;
    tableInitMarginY = parseFloat(activeTable.style.top)  || 0;
    e.preventDefault();

    if (selectedTableNode && selectedTableNode !== activeTable) {
        selectedTableNode.classList.remove('selected-for-deletion');
    }
    selectedTableNode = activeTable;
    selectedTableNode.classList.add('selected-for-deletion');
}

function _makeFloating(table) {
    const tRect = table.getBoundingClientRect();
    const parent = table.closest('.page-content') || document.getElementById('editor-container');
    const pRect = parent.getBoundingClientRect();
    
    table.style.position = 'absolute';
    table.style.zIndex   = '50';
    table.style.margin   = '0';
    // Position relative to parent page content
    table.style.left = (tRect.left - pRect.left + parent.scrollLeft) + 'px';
    table.style.top  = (tRect.top - pRect.top + parent.scrollTop) + 'px';
}

function _onDocMouseMove(e) {
    if (!isDraggingTable || !activeTable) return;
    let tx = tableInitMarginX + (e.clientX - dragStartX);
    let ty = tableInitMarginY + (e.clientY - dragStartY);
    if (e.ctrlKey) { tx = Math.round(tx / 16) * 16; ty = Math.round(ty / 16) * 16; }
    activeTable.style.left = tx + 'px';
    activeTable.style.top  = ty + 'px';
    _updateHandlePos();
}

// ── Column Resize ─────────────────────────────────────────────────────────────

function _onEditorMouseMove(e) {
    if (isDraggingTable) return;
    if (resizingCell) {
        resizingCell.style.width = (resizingStartWidth + (e.clientX - resizingStartX)) + 'px';
        e.preventDefault();
        return;
    }
    const cell = e.target.closest('th, td');
    const container = $('editor-container');
    if (cell && activeTable === cell.closest('table')) {
        const rect = cell.getBoundingClientRect();
        const isEdge = e.clientX > rect.right - 8 && e.clientX <= rect.right;
        container.style.cursor = isEdge ? 'col-resize' : '';
        cell.dataset.resizable = isEdge ? 'true' : 'false';
    } else {
        container.style.cursor = '';
    }
}

function _onEditorMouseDown(e) {
    const cell = e.target.closest('th, td');
    const container = $('editor-container');
    if (cell && cell.dataset.resizable === 'true' && container.style.cursor === 'col-resize') {
        resizingCell  = cell;
        resizingStartX = e.clientX;
        const table = cell.closest('table');
        if (table.style.tableLayout !== 'fixed') {
            for (const c of table.rows[0].cells) c.style.width = c.getBoundingClientRect().width + 'px';
            table.style.tableLayout = 'fixed';
            table.style.width = table.getBoundingClientRect().width + 'px';
        }
        resizingStartWidth = parseFloat(getComputedStyle(cell).width);
        e.preventDefault();
    }
}

// ── Global Mouse Up / Click / Keydown ─────────────────────────────────────────

function _onDocMouseUp() {
    if (isDraggingTable && activeTable) { 
        isDraggingTable = false; 

        // Reparenting logic for paged mode
        const container = document.getElementById('editor-container');
        if (container.classList.contains('paged-mode')) {
            const tRect = activeTable.getBoundingClientRect();
            const pages = container.querySelectorAll('.page-content');
            let targetPage = null;
            let maxOverlap = 0;

            for (const page of pages) {
                const pRect = page.getBoundingClientRect();
                const overlapStart = Math.max(tRect.top, pRect.top);
                const overlapEnd   = Math.min(tRect.bottom, pRect.bottom);
                const overlap      = Math.max(0, overlapEnd - overlapStart);
                
                if (overlap > maxOverlap) {
                    maxOverlap = overlap;
                    targetPage = page;
                }
            }

            if (targetPage && activeTable.parentElement !== targetPage) {
                targetPage.appendChild(activeTable);
                const tpRect = targetPage.getBoundingClientRect();
                const newTop = tRect.top - tpRect.top;
                const newLeft = tRect.left - tpRect.left;
                activeTable.style.top = newTop + 'px';
                activeTable.style.left = newLeft + 'px';
            }
        }

        syncActiveTabContent(_editor); 
    }
    if (resizingCell) { 
        resizingCell = null; 
        $('editor-container').style.cursor = ''; 
        syncActiveTabContent(_editor); 
    }
}

function _onDocClick(e) {
    if (selectedTableNode && !$('table-drag-handle').contains(e.target)) {
        selectedTableNode.classList.remove('selected-for-deletion');
        selectedTableNode = null;
    }
}

function _onDocKeyDown(e) {
    if (selectedTableNode && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        selectedTableNode.remove();
        selectedTableNode = null;
        $('table-drag-handle').style.display = 'none';
        $('table-tools').style.display       = 'none';
        activeTable = null;
        syncActiveTabContent(_editor);
        _editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// ── Row / Col operations ──────────────────────────────────────────────────────

function _addRow() {
    if (!activeTable || !activeRow) return;
    const newRow = activeTable.insertRow(activeRow.rowIndex + 1);
    for (let i = 0; i < activeRow.cells.length; i++) {
        const cell = document.createElement(activeRow.cells[i].tagName.toLowerCase());
        cell.textContent = 'Data';
        newRow.appendChild(cell);
    }
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function _addCol() {
    if (!activeTable || !activeCell) return;
    const idx = activeCell.cellIndex;
    for (const row of activeTable.rows) {
        const isHeader = row.cells[0]?.tagName.toLowerCase() === 'th';
        const cell     = document.createElement(isHeader ? 'th' : 'td');
        cell.textContent = isHeader ? 'Header' : 'Data';
        if (idx + 1 < row.cells.length) row.insertBefore(cell, row.cells[idx + 1]);
        else row.appendChild(cell);
    }
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function _delRow() {
    if (!activeTable || !activeRow) return;
    activeTable.deleteRow(activeRow.rowIndex);
    if (activeTable.rows.length === 0) activeTable.remove();
    checkTableContext();
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function _delCol() {
    if (!activeTable || !activeCell) return;
    const idx = activeCell.cellIndex;
    for (const row of activeTable.rows) {
        if (row.cells[idx]) row.deleteCell(idx);
    }
    if (activeTable.rows[0]?.cells.length === 0) activeTable.remove();
    checkTableContext();
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function _delTable() {
    if (!activeTable) return;
    activeTable.remove();
    activeTable = null;
    $('table-tools').style.display       = 'none';
    $('table-drag-handle').style.display = 'none';
    syncActiveTabContent(_editor);
    _editor.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Style Config Modal ────────────────────────────────────────────────────────

function _initStyleModal() {
    const styleModal       = $('table-style-modal');
    const borderWidthInput = $('style-border-width');
    const borderColorInput = $('style-border-color');
    const bgColorInput     = $('style-bg-color');

    $('btn-config-table').addEventListener('click', () => {
        if (!activeTable) return;
        const cell = activeTable.rows[0]?.cells[0];
        if (cell) {
            const bw = parseInt(getComputedStyle(cell).borderWidth);
            borderWidthInput.value = isNaN(bw) ? 2 : bw;
        }
        styleModal.classList.remove('hidden');
    });

    document.querySelector('[data-target="style-border-color"]').addEventListener('click', () => {
        styleModal.classList.add('hidden');
        openColorPicker(borderColorInput.value, 'Color Borde Tabla', (color) => {
            borderColorInput.value = color;
            $('style-border-indicator').style.backgroundColor = color;
            styleModal.classList.remove('hidden');
        }, () => styleModal.classList.remove('hidden'));
    });

    document.querySelector('[data-target="style-bg-color"]').addEventListener('click', () => {
        styleModal.classList.add('hidden');
        openColorPicker(bgColorInput.value, 'Color Fondo Tabla', (color) => {
            bgColorInput.value = color;
            $('style-bg-indicator').style.backgroundColor = color;
            styleModal.classList.remove('hidden');
        }, () => styleModal.classList.remove('hidden'));
    });

    $('btn-cancel-style').addEventListener('click', () => styleModal.classList.add('hidden'));

    $('btn-confirm-style').addEventListener('click', () => {
        if (!activeTable) return;
        const bw = borderWidthInput.value + 'px';
        const bc = borderColorInput.value;
        const bg = bgColorInput.value;
        activeTable.style.backgroundColor = bg !== 'transparent' ? bg : '';
        for (const row of activeTable.rows) {
            for (const cell of row.cells) {
                if (bc) cell.style.borderColor = bc;
                cell.style.borderWidth = bw;
                cell.style.borderStyle = borderWidthInput.value === '0' ? 'none' : 'solid';
            }
        }
        syncActiveTabContent(_editor);
        _editor.dispatchEvent(new Event('input', { bubbles: true }));
        styleModal.classList.add('hidden');
    });
}
