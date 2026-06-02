// ── Formatting Commands Tests ─────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCommand } from '/js/utils/formatting.js';

describe('Formatting Commands', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="editor" contenteditable="true"><p>Test <strong>bold</strong> text</p></div>';

        // Mock selection to return a valid range
        const mockRange = document.createRange();
        const editor = document.getElementById('editor');
        mockRange.selectNodeContents(editor);

        vi.spyOn(window, 'getSelection').mockReturnValue({
            rangeCount: 1,
            getRangeAt: vi.fn(() => mockRange),
            removeAllRanges: vi.fn(),
            addRange: vi.fn(),
            anchorNode: editor.querySelector('p'),
        });
    });

    describe('formatCommand', () => {
        it('should not throw when called with valid commands', () => {
            expect(() => formatCommand('bold')).not.toThrow();
            expect(() => formatCommand('italic')).not.toThrow();
            expect(() => formatCommand('foreColor', '#ff0000')).not.toThrow();
            expect(() => formatCommand('justifyLeft')).not.toThrow();
        });

        it('should fallback to execCommand for undo/redo', () => {
            // execCommand is already mocked in setup.js
            formatCommand('undo');
            formatCommand('redo');
            expect(document.execCommand).toHaveBeenCalledWith('undo', false, null);
            expect(document.execCommand).toHaveBeenCalledWith('redo', false, null);
        });

        it('should apply alignment to block elements', () => {
            // Select a text node inside the paragraph
            const p = document.querySelector('p');
            window.getSelection.mockReturnValue({
                rangeCount: 1,
                getRangeAt: vi.fn(() => {
                    const range = document.createRange();
                    range.selectNodeContents(p);
                    return range;
                }),
                anchorNode: p,
            });

            formatCommand('justifyCenter');
            expect(p.style.textAlign).toBe('center');
        });
    });
});
