// ── Debounce / Throttle Tests ─────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from '/js/utils/debounce.js';

describe('Debounce', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should delay execution until after the wait period', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        vi.advanceTimersByTime(50);
        debounced(); // should reset timer
        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 'b');
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a', 'b');
    });
});

describe('Throttle', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should execute immediately on first call', () => {
        const fn = vi.fn();
        const throttled = throttle(fn, 100);

        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not execute again within the throttle window', () => {
        const fn = vi.fn();
        const throttled = throttle(fn, 100);

        throttled();
        throttled();
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute again after the throttle window', () => {
        const fn = vi.fn();
        const throttled = throttle(fn, 100);

        throttled();
        vi.advanceTimersByTime(100);
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
