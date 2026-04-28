// ── DOM Utility Helpers ───────────────────────────────────────────────────────

/** Shorthand for document.getElementById */
export const $  = (id)  => document.getElementById(id);

/** Shorthand for document.querySelector */
export const $q = (sel) => document.querySelector(sel);

/** Shorthand for addEventListener */
export const on = (el, ev, fn) => el.addEventListener(ev, fn);

/**
 * Wraps the current text selection inside a <span> with the given
 * className and optional inline styles object.
 * Returns the created wrapper, or null if no valid selection.
 */
export function wrapSelection(className, styles = {}) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return null;

    const frag    = range.extractContents();
    const wrapper = document.createElement('span');
    wrapper.className = className;
    for (const [prop, val] of Object.entries(styles)) {
        wrapper.style.setProperty(prop, val);
    }
    wrapper.appendChild(frag);
    range.insertNode(wrapper);
    selection.removeAllRanges();
    return wrapper;
}

/** Trigger a browser download of text content */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
