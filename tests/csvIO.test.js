import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV } from '/js/modules/grid/csvIO.js';

describe('csvIO — parseCSV', () => {
    it('parses simple CSV', () => {
        const result = parseCSV('a,b,c\n1,2,3\n4,5,6');
        expect(result).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
            ['4', '5', '6'],
        ]);
    });

    it('trims whitespace from cells', () => {
        const result = parseCSV(' a , b , c \n 1 , 2 ');
        expect(result).toEqual([
            ['a', 'b', 'c'],
            ['1', '2'],
        ]);
    });

    it('handles quoted fields with commas', () => {
        const result = parseCSV('name,desc\nfoo,"has, commas"');
        expect(result).toEqual([
            ['name', 'desc'],
            ['foo', 'has, commas'],
        ]);
    });

    it('handles escaped quotes inside quoted fields', () => {
        const result = parseCSV('text\n"say ""hello"""');
        expect(result).toEqual([
            ['text'],
            ['say "hello"'],
        ]);
    });

    it('handles multiline quoted fields', () => {
        const result = parseCSV('a,b\n1,"line1\nline2\nline3"');
        expect(result).toEqual([
            ['a', 'b'],
            ['1', 'line1\nline2\nline3'],
        ]);
    });

    it('handles carriage returns (\\r\\n)', () => {
        const result = parseCSV('a,b\r\n1,2\r\n3,4');
        expect(result).toEqual([
            ['a', 'b'],
            ['1', '2'],
            ['3', '4'],
        ]);
    });

    it('handles empty cells', () => {
        const result = parseCSV('a,,c\n1,,3');
        expect(result).toEqual([
            ['a', '', 'c'],
            ['1', '', '3'],
        ]);
    });

    it('handles single line without newline', () => {
        const result = parseCSV('solo,un,renglon');
        expect(result).toEqual([
            ['solo', 'un', 'renglon'],
        ]);
    });
});

describe('csvIO — toCSV', () => {
    it('serializes headers + rows', () => {
        const csv = toCSV(['a', 'b'], [['1', '2'], ['3', '4']]);
        expect(csv).toBe('a,b\r\n1,2\r\n3,4');
    });

    it('escapes cells with commas', () => {
        const csv = toCSV(['name'], [['has, comma']]);
        expect(csv).toBe('name\r\n"has, comma"');
    });

    it('escapes cells with quotes', () => {
        const csv = toCSV(['text'], [['say "hello"']]);
        expect(csv).toBe('text\r\n"say ""hello"""');
    });

    it('escapes cells with newlines', () => {
        const csv = toCSV(['a'], [['line1\nline2']]);
        expect(csv).toBe('a\r\n"line1\nline2"');
    });

    it('handles null/undefined values as empty string', () => {
        const csv = toCSV(['x'], [[null]]);
        expect(csv).toBe('x\r\n');
    });

    it('handles empty data', () => {
        const csv = toCSV(['h'], []);
        expect(csv).toBe('h');
    });
});

describe('csvIO — roundtrip', () => {
    it('parseCSV(toCSV(...)) returns original data', () => {
        const headers = ['Name', 'Description', 'Value'];
        const rows = [
            ['foo', 'has, commas', '123'],
            ['bar', 'say "hi"', '456'],
            ['baz', 'multi\nline', '789'],
        ];
        const csv = toCSV(headers, rows);
        const parsed = parseCSV(csv);
        expect(parsed[0]).toEqual(headers);
        expect(parsed.slice(1)).toEqual(rows);
    });
});
