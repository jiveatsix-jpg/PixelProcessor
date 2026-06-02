// ── Vitest Setup ──────────────────────────────────────────────────────────────
import { vi } from 'vitest';

// Mock browser APIs that jsdom doesn't fully support
Object.defineProperty(window, 'getSelection', {
    value: vi.fn(() => ({
        rangeCount: 0,
        getRangeAt: vi.fn(),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
    })),
});

Object.defineProperty(document, 'execCommand', {
    value: vi.fn(() => true),
});

// Mock localStorage
const store = {};
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    },
});
