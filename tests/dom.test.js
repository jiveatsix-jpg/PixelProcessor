// ── DOM Utility Tests ─────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { $, $q, on } from '/js/utils/dom.js';

describe('DOM Utilities', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-container">
                <p class="item">First</p>
                <p class="item">Second</p>
                <span id="child">Child</span>
            </div>
        `;
    });

    describe('$ (getElementById)', () => {
        it('should return an element by id', () => {
            const el = $('test-container');
            expect(el).toBeTruthy();
            expect(el.id).toBe('test-container');
        });

        it('should return null for non-existent id', () => {
            expect($('nonexistent')).toBeNull();
        });
    });

    describe('$q (querySelector)', () => {
        it('should return the first matching element', () => {
            const el = $q('.item');
            expect(el).toBeTruthy();
            expect(el.textContent).toBe('First');
        });

        it('should return null for no match', () => {
            expect($q('.nonexistent')).toBeNull();
        });
    });

    describe('on (addEventListener)', () => {
        it('should attach an event listener', () => {
            const el = $('test-container');
            const handler = vi.fn();
            on(el, 'click', handler);

            el.dispatchEvent(new Event('click'));
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });
});
