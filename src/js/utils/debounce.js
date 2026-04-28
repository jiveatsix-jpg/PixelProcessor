// ── Debounce / Throttle Utilities ─────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that fires after `ms` ms of inactivity.
 */
export function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Returns a throttled version of `fn` that fires at most once per `ms` ms.
 */
export function throttle(fn, ms) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn(...args);
        }
    };
}
