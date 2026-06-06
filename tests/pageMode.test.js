import { describe, it, expect } from 'vitest';
import { _splitElement } from '../src/js/modules/pageMode.js';

describe('Page Mode Split Element', () => {
    it('should split plain text element correctly', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.textContent = 'Hello World';

        const rightEl = _splitElement(el, 6);

        expect(el.textContent).toBe('Hello ');
        expect(rightEl.textContent).toBe('World');
        expect(rightEl.dataset.splitContinuation).toBe('true');
    });

    it('should split element with nested HTML correctly', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.innerHTML = 'Hello <b>World!</b>';

        const rightEl = _splitElement(el, 8);

        expect(el.innerHTML).toBe('Hello <b>Wo</b>');
        expect(rightEl.innerHTML).toBe('<b>rld!</b>');
        expect(rightEl.dataset.splitContinuation).toBe('true');
    });

    it('should handle split index at 0', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.textContent = 'Hello World';

        const rightEl = _splitElement(el, 0);

        expect(el.textContent).toBe('');
        expect(rightEl.textContent).toBe('Hello World');
    });

    it('should handle split index greater than length', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.textContent = 'Hello World';

        const rightEl = _splitElement(el, 20);

        expect(el.textContent).toBe('Hello World');
        expect(rightEl.textContent).toBe('');
    });

    it('should preserve styles on the right half after splitting', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.style.textAlign = 'center';
        el.textContent = 'Hello World';

        const rightEl = _splitElement(el, 6);

        expect(rightEl.style.textAlign).toBe('center');
        expect(rightEl.className).toBe('editor-line');
    });

    it('should handle deeply nested elements', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.innerHTML = '<b><i>Hello World</i></b>';

        const rightEl = _splitElement(el, 5);

        expect(el.innerHTML).toBe('<b><i>Hello</i></b>');
        expect(rightEl.innerHTML).toBe('<b><i> World</i></b>');
    });

    it('should handle multiple text nodes with formatting', () => {
        const el = document.createElement('div');
        el.className = 'editor-line';
        el.innerHTML = 'Normal <b>Bold</b> More';

        const rightEl = _splitElement(el, 9);

        // "Normal " = 7 chars, "Bold" = 4 chars => split at 9 is inside "Bold" at position 2
        expect(el.innerHTML).toBe('Normal <b>Bo</b>');
        expect(rightEl.innerHTML).toBe('<b>ld</b> More');
    });
});
