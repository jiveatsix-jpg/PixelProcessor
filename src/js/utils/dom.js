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

/**
 * Detaches `el` from normal flow into an absolutely-positioned floating
 * element, anchored to its closest `.page-content` (or #editor-container as
 * fallback), keeping its current visual position. Used for images/tables
 * that the user can freely drag/resize on top of a page.
 */
export function makeFloating(el, zIndex = '50') {
    const rect   = el.getBoundingClientRect();
    const parent = el.closest('.page-content') || document.getElementById('editor-container');
    const pRect  = parent.getBoundingClientRect();

    el.style.position = 'absolute';
    el.style.zIndex   = zIndex;
    el.style.margin   = '0';
    el.style.left = (rect.left - pRect.left + parent.scrollLeft) + 'px';
    el.style.top  = (rect.top - pRect.top + parent.scrollTop) + 'px';
}

/**
 * On drag-end in paged mode, reparent a floating element into whichever
 * `.page-content` it now visually overlaps the most, keeping it visually
 * anchored (offsets recomputed relative to the new page).
 *
 * @param {HTMLElement} movedEl - element whose bounding rect determines overlap and whose top/left get repositioned.
 * @param {HTMLElement} [reparentTarget=movedEl] - node actually moved into the new page (e.g. a wrapper around movedEl).
 * @param {boolean} [setLeft=true] - also reposition `left` (some callers only track vertical position).
 * @param {boolean} [fallbackToFirstPage=false] - if no page overlaps at all, reparent into the first page anyway.
 */
export function reparentToOverlappingPage(movedEl, { reparentTarget = movedEl, setLeft = true, fallbackToFirstPage = false } = {}) {
    if (!reparentTarget) return;
    const pages = Array.from(document.querySelectorAll('.page-content'));
    if (!pages.length) return;

    const rect = movedEl.getBoundingClientRect();
    let targetPage = fallbackToFirstPage ? pages[0] : null;
    let maxOverlap = 0;
    for (const page of pages) {
        const pRect        = page.getBoundingClientRect();
        const overlapStart = Math.max(rect.top, pRect.top);
        const overlapEnd   = Math.min(rect.bottom, pRect.bottom);
        const overlap      = Math.max(0, overlapEnd - overlapStart);
        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            targetPage = page;
        }
    }

    if (targetPage && reparentTarget.parentElement !== targetPage) {
        targetPage.appendChild(reparentTarget);
        const tpRect = targetPage.getBoundingClientRect();
        movedEl.style.top = (rect.top - tpRect.top) + 'px';
        if (setLeft) movedEl.style.left = (rect.left - tpRect.left) + 'px';
    }
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
