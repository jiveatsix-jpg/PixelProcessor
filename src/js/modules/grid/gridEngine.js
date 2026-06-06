// ── Grid Engine — data model + CRUD ──────────────────────────────────────────

/** Create a blank grid document */
export function createBlankGrid() {
    return {
        headers: ['Columna A', 'Columna B', 'Columna C'],
        rows: [['', '', '']],
        columns: [
            { type: 'text' },
            { type: 'text' },
            { type: 'text' },
        ],
    };
}

/** Add a row at the given index (default: end) */
export function addRow(grid, index) {
    const cols = grid.headers.length;
    const newRow = new Array(cols).fill('');
    if (index === undefined || index >= grid.rows.length) {
        grid.rows.push(newRow);
    } else {
        grid.rows.splice(index, 0, newRow);
    }
}

/** Add a column at the given index (default: end) */
export function addColumn(grid, index) {
    const name = `Col ${String.fromCharCode(65 + grid.headers.length)}`;
    if (index === undefined || index >= grid.headers.length) {
        grid.headers.push(name);
        grid.columns.push({ type: 'text' });
        grid.rows.forEach(r => r.push(''));
    } else {
        grid.headers.splice(index, 0, name);
        grid.columns.splice(index, 0, { type: 'text' });
        grid.rows.forEach(r => r.splice(index, 0, ''));
    }
}

/** Delete a row */
export function delRow(grid, index) {
    if (grid.rows.length <= 1) return; // keep at least one
    grid.rows.splice(index, 1);
}

/** Delete a column */
export function delColumn(grid, index) {
    if (grid.headers.length <= 1) return;
    grid.headers.splice(index, 1);
    grid.columns.splice(index, 1);
    grid.rows.forEach(r => r.splice(index, 1));
}

/** Set cell value */
export function setCell(grid, rowIndex, colIndex, value) {
    if (grid.rows[rowIndex] && colIndex < grid.rows[rowIndex].length) {
        grid.rows[rowIndex][colIndex] = value;
    }
}

/** Set column type (e.g. 'text' → 'category' with options) */
export function setColumnType(grid, colIndex, type, options) {
    if (grid.columns[colIndex]) {
        grid.columns[colIndex] = { type, options: options || [] };
    }
}

/** Map CSV headers to grid columns: reuse existing, create missing at end */
export function mapHeadersToColumns(grid, newHeaders) {
    const added = [];
    newHeaders.forEach(h => {
        const trimmed = h.trim();
        const existing = grid.headers.findIndex(ex => ex.toLowerCase() === trimmed.toLowerCase());
        if (existing >= 0) return existing;
        grid.headers.push(trimmed);
        grid.columns.push({ type: 'text' });
        grid.rows.forEach(r => r.push(''));
        added.push(grid.headers.length - 1);
    });
    return added;
}
