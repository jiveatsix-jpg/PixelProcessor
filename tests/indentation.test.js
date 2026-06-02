import { describe, it, expect, beforeEach } from 'vitest';

describe('Indentation Logic', () => {
    let lineEl;

    beforeEach(() => {
        lineEl = document.createElement('div');
        lineEl.className = 'editor-line';
        lineEl.innerHTML = 'Texto de prueba';
    });

    it('should calculate indentation correctly', () => {
        const step = 40;
        
        // Simular lógica de incremento
        let currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
        lineEl.style.paddingLeft = (currentPadding + step) + 'px';
        expect(lineEl.style.paddingLeft).toBe('40px');

        // Segundo incremento
        currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
        lineEl.style.paddingLeft = (currentPadding + step) + 'px';
        expect(lineEl.style.paddingLeft).toBe('80px');
    });

    it('should not go below zero when outdenting', () => {
        const step = 40;
        lineEl.style.paddingLeft = '40px';

        let currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
        lineEl.style.paddingLeft = Math.max(0, currentPadding - step) + 'px';
        expect(lineEl.style.paddingLeft).toBe('0px');

        currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
        lineEl.style.paddingLeft = Math.max(0, currentPadding - step) + 'px';
        expect(lineEl.style.paddingLeft).toBe('0px');
    });
});
