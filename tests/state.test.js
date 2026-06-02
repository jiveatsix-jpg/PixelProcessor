// ── State Module Tests ────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock the config module before importing state
vi.doMock('/js/config.js', () => ({
    DEFAULT_PALETTE: ['#F0F0F0', '#FF6B6B', '#4ECDC4'],
    LS_KEYS: {
        DOCUMENTS: 'pixelDocuments',
        OLD_CONTENT: 'pixelWordContent',
        PALETTE: 'pixelPalette',
    },
}));

const { getState, get, set, subscribe, mutate, state, loadStateFromStorage, saveDocumentsToStorage } = await import('/js/state.js');

describe('State Module', () => {
    beforeEach(() => {
        // Reset state
        state.documents = [];
        state.activeTabId = null;
        state.currentPalette = ['#F0F0F0', '#FF6B6B', '#4ECDC4'];
        localStorage.clear();
    });

    describe('get / set', () => {
        it('should get a state property', () => {
            state.isPagedMode = true;
            expect(get('isPagedMode')).toBe(true);
        });

        it('should set a state property', () => {
            set('isPagedMode', false);
            expect(state.isPagedMode).toBe(false);
        });

        it('should return a snapshot with getState', () => {
            state.activeTabId = '123';
            const snapshot = getState();
            expect(snapshot.activeTabId).toBe('123');
        });
    });

    describe('subscribe', () => {
        it('should notify subscribers when state changes', () => {
            // Ensure known state before testing
            state.isPagedMode = true;
            const callback = vi.fn();
            subscribe('isPagedMode', callback);

            set('isPagedMode', false);
            expect(callback).toHaveBeenCalled();
            expect(callback.mock.calls[0][0]).toBe(false); // new value
        });

        it('should return an unsubscribe function', () => {
            const callback = vi.fn();
            const unsub = subscribe('activeTabId', callback);

            set('activeTabId', 'abc');
            expect(callback).toHaveBeenCalledTimes(1);

            unsub();
            set('activeTabId', 'def');
            expect(callback).toHaveBeenCalledTimes(1); // not called again
        });
    });

    describe('mutate', () => {
        it('should mutate arrays and notify', () => {
            state.documents = [];
            const callback = vi.fn();
            subscribe('documents', callback);

            mutate('documents', docs => {
                docs.push({ id: '1', title: 'Test', content: '' });
            });

            expect(state.documents.length).toBe(1);
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('loadStateFromStorage', () => {
        it('should create default document when storage is empty', () => {
            loadStateFromStorage();
            expect(state.documents.length).toBe(1);
            expect(state.documents[0].title).toBe('Document 1');
        });

        it('should load documents from localStorage', () => {
            const docs = [{ id: 'test', title: 'Loaded', content: '<p>hi</p>' }];
            localStorage.setItem('pixelDocuments', JSON.stringify(docs));
            loadStateFromStorage();
            expect(state.documents[0].title).toBe('Loaded');
        });

        it('should migrate legacy content', () => {
            localStorage.setItem('pixelWordContent', '<p>legacy</p>');
            loadStateFromStorage();
            expect(state.documents[0].content).toBe('<p>legacy</p>');
            expect(localStorage.getItem('pixelWordContent')).toBeNull();
        });
    });

    describe('saveDocumentsToStorage', () => {
        it('should persist documents to localStorage', () => {
            state.documents = [{ id: '1', title: 'Save Test', content: '<p>test</p>' }];
            saveDocumentsToStorage();
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'pixelDocuments',
                JSON.stringify(state.documents)
            );
        });
    });
});
