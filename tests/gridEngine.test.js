import { describe, it, expect, beforeEach } from 'vitest';
import { createBlankGrid, addRow, addColumn, delRow, delColumn, setCell, setColumnType, mapHeadersToColumns } from '/js/modules/grid/gridEngine.js';

function freshGrid() {
    return createBlankGrid();
}

describe('gridEngine — createBlankGrid', () => {
    it('returns default 3-column structure', () => {
        const g = createBlankGrid();
        expect(g.headers).toEqual(['Columna A', 'Columna B', 'Columna C']);
        expect(g.rows).toHaveLength(1);
        expect(g.rows[0]).toEqual(['', '', '']);
        expect(g.columns).toHaveLength(3);
        g.columns.forEach(c => expect(c).toEqual({ type: 'text' }));
    });
});

describe('gridEngine — addRow', () => {
    it('appends a row at the end by default', () => {
        const g = freshGrid();
        addRow(g);
        expect(g.rows).toHaveLength(2);
        expect(g.rows[1]).toEqual(['', '', '']);
    });

    it('inserts a row at a given index', () => {
        const g = freshGrid();
        g.rows[0] = ['a', 'b', 'c'];
        addRow(g, 0);
        expect(g.rows).toHaveLength(2);
        expect(g.rows[0]).toEqual(['', '', '']);
        expect(g.rows[1]).toEqual(['a', 'b', 'c']);
    });

    it('creates a row with the right column count after adding columns', () => {
        const g = freshGrid();
        addColumn(g);
        addRow(g);
        expect(g.rows[1]).toHaveLength(4);
    });
});

describe('gridEngine — addColumn', () => {
    it('appends a column at the end by default', () => {
        const g = freshGrid();
        addColumn(g);
        expect(g.headers).toHaveLength(4);
        expect(g.headers[3]).toBe('Col D');
        expect(g.columns).toHaveLength(4);
        g.rows.forEach(r => expect(r).toHaveLength(4));
    });

    it('inserts a column at a given index', () => {
        const g = freshGrid();
        g.rows[0] = ['x', 'y', 'z'];
        addColumn(g, 1);
        expect(g.headers[1]).toBe('Col D');
        expect(g.rows[0]).toEqual(['x', '', 'y', 'z']);
    });
});

describe('gridEngine — delRow', () => {
    it('removes a row at the given index', () => {
        const g = freshGrid();
        addRow(g);
        addRow(g);
        g.rows[1] = ['to-delete'];
        delRow(g, 1);
        expect(g.rows).toHaveLength(2);
    });

    it('does NOT delete when only one row remains', () => {
        const g = freshGrid();
        delRow(g, 0);
        expect(g.rows).toHaveLength(1);
    });
});

describe('gridEngine — delColumn', () => {
    it('removes a column and updates all rows', () => {
        const g = freshGrid();
        g.rows[0] = ['a', 'b', 'c'];
        delColumn(g, 1);
        expect(g.headers).toHaveLength(2);
        expect(g.headers[1]).toBe('Columna C');
        expect(g.rows[0]).toEqual(['a', 'c']);
    });

    it('does NOT delete when only one column remains', () => {
        const g = freshGrid();
        delColumn(g, 0);
        delColumn(g, 0);
        expect(g.headers).toHaveLength(1);
    });
});

describe('gridEngine — setCell', () => {
    it('sets a cell value', () => {
        const g = freshGrid();
        setCell(g, 0, 1, 'hello');
        expect(g.rows[0][1]).toBe('hello');
    });

    it('does nothing for out-of-bounds indices', () => {
        const g = freshGrid();
        expect(() => setCell(g, 99, 0, 'x')).not.toThrow();
        expect(() => setCell(g, 0, 99, 'x')).not.toThrow();
    });
});

describe('gridEngine — setColumnType', () => {
    it('sets a column to category type with options', () => {
        const g = freshGrid();
        setColumnType(g, 0, 'category', ['Alta', 'Media', 'Baja']);
        expect(g.columns[0]).toEqual({ type: 'category', options: ['Alta', 'Media', 'Baja'] });
    });

    it('does nothing for out-of-bounds index', () => {
        const g = freshGrid();
        expect(() => setColumnType(g, 99, 'category', [])).not.toThrow();
    });
});

describe('gridEngine — mapHeadersToColumns', () => {
    it('reuses an existing column by case-insensitive match', () => {
        const g = freshGrid();
        const added = mapHeadersToColumns(g, ['columna b']);
        expect(added).toEqual([]);
        expect(g.headers).toHaveLength(3);
        expect(g.rows[0]).toHaveLength(3);
    });

    it('creates new columns for unmatched headers at the end', () => {
        const g = freshGrid();
        const added = mapHeadersToColumns(g, ['Nueva']);
        expect(added).toEqual([3]);
        expect(g.headers).toHaveLength(4);
        expect(g.headers[3]).toBe('Nueva');
        expect(g.columns[3]).toEqual({ type: 'text' });
    });

    it('mixed: one existing, one new', () => {
        const g = freshGrid();
        const added = mapHeadersToColumns(g, ['columna a', 'extra']);
        expect(added).toEqual([3]);
        expect(g.headers).toHaveLength(4);
        expect(g.headers[3]).toBe('extra');
    });
});
