// ── Page Mode Engine (Automatic pagination) ────────────────────────────────────
// Each page is a fixed-size contentEditable div. Content that overflows a page
// automatically flows onto the next one (creating it if needed), and shrinks
// back when content is deleted. "Add Page"/"Delete Page" remain as a manual
// override on top of the automatic reflow. See _pushOverflow/_pullBack below.

import { $ } from '../utils/dom.js';
import { syncActiveTabContent, registerRawTextGetter } from '../state.js';
import { debounce } from '../utils/debounce.js';

let _editor    = null;
let _container = null;
let _rawText   = '';

const TAB_SIZE = 40; // 40px tab stops
const MAX_PAGES = 300; // safety circuit-breaker against a runaway reflow loop, not a content cap
const PULL_BACK_DEBOUNCE_MS = 150;

/** Initialize Page Mode. Called once at startup. */
export function initPageMode(editor) {
    _editor    = editor;
    _container = $('editor-container');
    _container.classList.add('paged-mode');

    // Margin controls
    const mY = $('page-margin-y');
    const mX = $('page-margin-x');
    if (mY && mX) {
        _applyMargins(mY.value, mX.value);
        mY.oninput = () => _applyMargins(mY.value, mX.value);
        mX.oninput = () => _applyMargins(mX.value, mX.value);
    }

    // Build initial page structure from saved content
    _buildPagesFromRawText(_editor.innerText || '');
    registerRawTextGetter(() => _serializePages());

    // Bind input events to all page content areas
    _bindPageEvents();

    // Add Page button
    const btnAddPage = $('btn-add-page');
    if (btnAddPage) {
        btnAddPage.addEventListener('click', addPage);
    }

    // Delete Page button
    const btnDeletePage = $('btn-delete-page');
    if (btnDeletePage) {
        btnDeletePage.addEventListener('click', deletePage);
    }
}

function _applyMargins(y, x) {
    _container.style.setProperty('--page-padding-y', y + 'px');
    _container.style.setProperty('--page-padding-x', x + 'px');
}

// ── Page Lifecycle ────────────────────────────────────────────────────────────

/** Create a new page element and append to container. */
function _createPage(index = 0) {
    const pageEl = document.createElement('div');
    pageEl.className = 'editor-page';
    pageEl.dataset.pageIndex = index;

    const contentEl = document.createElement('div');
    contentEl.className = 'page-content pixel-editor';
    // Respect reading mode: pages created while reading mode is active
    // (e.g. via "Add Page") must not become editable.
    contentEl.contentEditable = document.body.classList.contains('reading-mode') ? 'false' : 'true';
    contentEl.spellcheck = true;
    contentEl.lang = 'es';
    contentEl.dataset.role = 'page-content';

    pageEl.appendChild(contentEl);

    // Gap between pages
    if (_container.querySelector('.editor-page')) {
        const gap = document.createElement('div');
        gap.className = 'page-break-divider';
        _container.appendChild(gap);
    }

    _container.appendChild(pageEl);
    _observePage(contentEl);
    return contentEl;
}

/** Remove a page and its observer. */
function _removePage(pageEl) {
    const contentEl = pageEl.querySelector('.page-content');
    if (contentEl && contentEl._childObserver) {
        contentEl._childObserver.disconnect();
        delete contentEl._childObserver;
    }
    // Remove preceding gap too
    const gap = pageEl.previousElementSibling;
    if (gap && gap.classList.contains('page-break-divider')) gap.remove();
    pageEl.remove();
}

/** Get all page content elements in order. */
function _getPageContents() {
    return Array.from(_container.querySelectorAll('.page-content'));
}

/** Index of a given .page-content element, or -1 if not found/detached. */
function _pageIndexOf(contentEl) {
    return _getPageContents().indexOf(contentEl);
}

// ── Observers ─────────────────────────────────────────────────────────────────

/** Watch for new children (created by contentEditable Enter) and
 *  ensure they get the .editor-line class for styling. Tables are left
 *  unclassed — code elsewhere (ArrowUp/Down, Backspace-merge, cursor
 *  restoration) assumes `.editor-line` is always a text line. */
function _observePage(contentEl) {
    const childObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node.parentElement === contentEl && node.tagName !== 'TABLE') {
                        node.classList.add('editor-line');
                    }
                }
            }
        }
    });
    // Observe direct children only (not subtree)
    childObserver.observe(contentEl, { childList: true });
    contentEl._childObserver = childObserver;
}

// ── Public: Add / Delete page ──────────────────────────────────────────────

/** Create a new blank page after the last existing page. */
export function addPage() {
    const pages = _container.querySelectorAll('.editor-page');
    const idx = pages.length;
    const contentEl = _createPage(idx);
    if (contentEl.children.length === 0) {
        const p = document.createElement('div');
        p.className = 'editor-line';
        p.innerHTML = '<br>';
        contentEl.appendChild(p);
    }
    flushReflowNow(idx);
    contentEl.focus();
    return contentEl;
}

/** Delete the currently focused page (or last page). */
export function deletePage() {
    const pages = _container.querySelectorAll('.editor-page');
    if (pages.length <= 1) return; // never delete the last page

    // Find the active page (the one with selection/cursor)
    let targetPage = null;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const node = sel.anchorNode;
        if (node) {
            const contentEl = node.nodeType === Node.ELEMENT_NODE
                ? node.closest('.page-content')
                : node.parentElement?.closest('.page-content');
            if (contentEl) {
                targetPage = contentEl.closest('.editor-page');
            }
        }
    }

    // Fallback to last page
    if (!targetPage) {
        targetPage = pages[pages.length - 1];
    }

    const pageIdx = Array.from(pages).indexOf(targetPage);

    // Move content to previous page before removing
    if (pageIdx > 0) {
        const prevContent = pages[pageIdx - 1].querySelector('.page-content');
        const curContent = targetPage.querySelector('.page-content');
        while (curContent.firstChild) {
            prevContent.appendChild(curContent.firstChild);
        }
        // Focus previous page at the end
        const lastLine = prevContent.lastElementChild;
        if (lastLine) _setCursor(lastLine, lastLine.textContent.length);
    }

    _removePage(targetPage);
    _reindexPages();
    flushReflowNow(Math.max(0, pageIdx - 1));
}

// ── Initial Page Build ────────────────────────────────────────────────────────

// Bumped on every _buildPagesFromRawText call (i.e. every tab switch/load).
// The deferred fonts.ready re-check below captures this value and bails out
// if it's stale — otherwise, switching tabs again before fonts finish loading
// leaves a queued flushReflowNow(0) that fires later against whatever
// document happens to be active *then*, corrupting the wrong tab's content.
let _buildGeneration = 0;

/** Build pages from raw text (on load or tab switch). */
function _buildPagesFromRawText(rawText) {
    const myGeneration = ++_buildGeneration;

    // Clear existing pages
    const existing = _container.querySelectorAll('.editor-page, .page-break-divider');
    existing.forEach(el => el.remove());
    // Clean up all child MutationObservers
    _container.querySelectorAll('.page-content').forEach(el => {
        if (el._childObserver) {
            el._childObserver.disconnect();
            delete el._childObserver;
        }
    });

    // Create first page
    const firstPage = _createPage(0);

    // Parse lines and render
    const lines = rawText.split('\n');
    lines.forEach(line => {
        _appendLine(firstPage, line);
    });

    // If no content, add empty paragraph
    if (firstPage.children.length === 0) {
        const p = document.createElement('div');
        p.className = 'editor-line';
        p.innerHTML = '<br>';
        firstPage.appendChild(p);
    }

    // Everything lands on page 0 above (raw text has no page-break markers);
    // reflow now redistributes overflow onto fresh pages as needed. This also
    // fixes the old silent-data-loss bug where content beyond the line cap
    // was deleted outright on every reload of a multi-page document.
    flushReflowNow(0);
    // Re-run once fonts have actually loaded: the pixel-art web font may still
    // be using fallback metrics on the first measurement, which can produce
    // an incorrect (too early or too late) page break. Only applies if this
    // is still the most recent build (see _buildGeneration above).
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (_buildGeneration !== myGeneration) return;
            flushReflowNow(0);
        });
    }
}

/** Append a line of content to a page content element. */
function _appendLine(contentEl, line) {
    if (line.startsWith('[[IMG:')) {
        try {
            const data = JSON.parse(line.slice(6, -2));
            const img = document.createElement('img');
            img.src = data.src;
            img.setAttribute('style', data.style || '');
            img.style.maxWidth = '100%';
            img.style.imageRendering = 'pixelated';
            contentEl.appendChild(img);
        } catch {
            const err = document.createElement('div');
            err.className = 'editor-line';
            err.textContent = '[Error al cargar imagen]';
            contentEl.appendChild(err);
        }
    } else if (line.trim().startsWith('<table')) {
        const wrap = document.createElement('div');
        wrap.innerHTML = line;
        if (wrap.firstChild) contentEl.appendChild(wrap.firstChild);
    } else {
        let lineStyle = '';
        let lineContent = line;
        const styleMatch = line.match(/^\[\[STYLE:([^\]]+)\]\](.*)$/s);
        if (styleMatch) {
            lineStyle = styleMatch[1];
            lineContent = styleMatch[2];
        }

        const lineEl = document.createElement('div');
        lineEl.className = 'editor-line';
        if (lineStyle) lineEl.setAttribute('style', lineStyle);
        lineEl.innerHTML = lineContent || '<br>';
        contentEl.appendChild(lineEl);
    }
}

// ── Event Binding ─────────────────────────────────────────────────────────────

/** Bind keyboard and input events to all page content areas. */
function _bindPageEvents() {
    _container.addEventListener('keydown', _handleKeyDown, true);
    _container.addEventListener('input', _handleInput, true);
    _container.addEventListener('paste', _handlePaste, true);
}

function _handleInput(e) {
    const contentEl = e.target.closest?.('.page-content');
    if (!contentEl) return;
    scheduleReflow(_pageIndexOf(contentEl));
}

// Tags stripped entirely (with their contents) from pasted HTML.
const _PASTE_DANGEROUS_TAGS = 'script, iframe, object, embed, style, link, meta, img, svg, form, input, button, video, audio, source';

/** Sanitizes clipboard HTML (removes scripts/embeds and any attribute other
 *  than style/class — style/class are what carry bold/color/highlight/glow/
 *  chroma-morph formatting) and splits it into per-line HTML strings. Returns
 *  null if the HTML has no usable content, so the caller can fall back to
 *  plain text. */
function _sanitizedHtmlToLines(html) {
    const container = document.createElement('div');
    container.innerHTML = html;

    container.querySelectorAll(_PASTE_DANGEROUS_TAGS).forEach(el => el.remove());
    container.querySelectorAll('*').forEach(el => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (name !== 'style' && name !== 'class') el.removeAttribute(attr.name);
        }
    });

    // A selection crossing multiple lines copies the block-level wrappers
    // (div/p) too — each becomes its own pasted line. A selection within a
    // single line copies only inline content, which becomes one line.
    const blockChildren = Array.from(container.children).filter(el => el.tagName === 'DIV' || el.tagName === 'P');
    if (blockChildren.length > 0) return blockChildren.map(el => el.innerHTML);

    const inlineHTML = container.innerHTML.trim();
    return inlineHTML ? [inlineHTML] : null;
}

function _handlePaste(e) {
    const contentEl = e.target.closest?.('.page-content');
    if (!contentEl) return;

    e.preventDefault();

    const clipboardData = e.clipboardData || window.clipboardData;
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    // Prefer the clipboard's HTML so rich formatting (bold, color, highlight,
    // glow, chroma-morph) survives — e.g. copying styled text in one tab and
    // pasting it into another, which previously always flattened to plain
    // text. Falls back to plain text for pastes with no HTML (e.g. from a
    // plain text editor) or where the HTML sanitizes down to nothing.
    const lineHTMLs = html ? _sanitizedHtmlToLines(html) : null;

    let lines = null;
    if (!lineHTMLs) {
        if (!text) return;
        lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        // Strip trailing empty element from trailing newline
        if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
        if (lines.length === 0) return;
    }

    // Get current line at cursor
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
    const currentLine = startNode.closest('.editor-line');
    if (!currentLine) return;

    // Save text before / after cursor (for splitting the current line).
    // Note: this flattens any existing formatting on the CURRENT line at the
    // split point (unchanged from before) — only the newly pasted content's
    // own formatting is preserved.
    const textBefore = currentLine.textContent.slice(0, range.startOffset);
    const textAfter  = currentLine.textContent.slice(range.startOffset);
    currentLine.textContent = textBefore;

    // Create new line elements
    const frag = document.createDocumentFragment();
    if (lineHTMLs) {
        for (const lineHTML of lineHTMLs) {
            const div = document.createElement('div');
            div.className = 'editor-line';
            div.innerHTML = lineHTML || '<br>';
            frag.appendChild(div);
        }
    } else {
        for (let i = 0; i < lines.length; i++) {
            const div = document.createElement('div');
            div.className = 'editor-line';
            if (lines[i] === '') {
                div.innerHTML = '<br>';
            } else {
                div.textContent = lines[i];
            }
            frag.appendChild(div);
        }
    }

    // Append remaining text after cursor to LAST pasted line — appendChild a
    // text node rather than `textContent +=`, which would wipe out any rich
    // content (spans/formatting) the last pasted line just got from the HTML.
    if (textAfter) {
        const last = frag.lastChild;
        if (last) last.appendChild(document.createTextNode(textAfter));
    }

    // Insert after current line
    const nextSibling = currentLine.nextElementSibling;
    contentEl.insertBefore(frag, nextSibling);

    // Move cursor to end of last pasted line
    const linesEls = contentEl.querySelectorAll('.editor-line');
    const lastLine = linesEls[linesEls.length - 1];
    if (lastLine) _setCursor(lastLine, lastLine.textContent.length);

    flushReflowNow(_pageIndexOf(contentEl));
}

function _handleKeyDown(e) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;

    const contentEl = node?.closest?.('.page-content');
    if (!contentEl) return;

    const pageEl = contentEl.closest('.editor-page');
    const pages = Array.from(_container.querySelectorAll('.editor-page'));
    const pIdx = pages.indexOf(pageEl);

    // Tab: insert spaces or indent
    if (e.key === 'Tab') {
        e.preventDefault();
        const lineEl = node.closest('.editor-line');

        let isAtStart = false;
        if (lineEl && range.collapsed) {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(lineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            isAtStart = preRange.toString().length === 0;
        }

        if (lineEl && (isAtStart || e.shiftKey)) {
            _adjustIndentation(lineEl, e.shiftKey ? -1 : 1);
        } else {
            document.execCommand('insertText', false, '    ');
        }
        return;
    }

    // ArrowDown: jump to next page if at last line
    if (e.key === 'ArrowDown') {
        const lineEl = node.closest('.editor-line');
        if (lineEl && !lineEl.nextElementSibling && pIdx < pages.length - 1) {
            e.preventDefault();
            const nextPage = pages[pIdx + 1];
            const firstLine = nextPage.querySelector('.editor-line');
            if (firstLine) _setCursor(firstLine, 0);
        }
    }

    // ArrowUp: jump to prev page if at first line
    if (e.key === 'ArrowUp') {
        const lineEl = node.closest('.editor-line');
        if (lineEl && !lineEl.previousElementSibling && pIdx > 0) {
            e.preventDefault();
            const prevPage = pages[pIdx - 1];
            const lines = prevPage.querySelectorAll('.editor-line');
            const lastLine = lines[lines.length - 1];
            if (lastLine) _setCursor(lastLine, lastLine.textContent.length);
        }
    }

    // Backspace at start of first line: merge with previous page
    if (e.key === 'Backspace' && range.collapsed && range.startOffset === 0) {
        const lineEl = node.closest('.editor-line');
        if (!lineEl) return;

        // First, check if we should just reduce indentation
        const currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
        if (currentPadding > 0) {
            e.preventDefault();
            _adjustIndentation(lineEl, -1);
            return;
        }

        // Merge current page's first line into previous page
        if (lineEl && !lineEl.previousElementSibling && pIdx > 0) {
            e.preventDefault();
            const prevPage = pages[pIdx - 1];
            const prevContent = prevPage.querySelector('.page-content');
            const lines = prevContent.querySelectorAll('.editor-line');
            const lastLine = lines[lines.length - 1];

            if (lastLine) {
                const cursorPos = lastLine.textContent.length;
                const firstLine = contentEl.querySelector('.editor-line');
                if (firstLine) {
                    prevContent.appendChild(firstLine);
                }
                _setCursor(lastLine, cursorPos);

                // If current page is now empty, remove it
                if (contentEl.children.length === 0 ||
                    (contentEl.children.length === 1 && contentEl.querySelector('.editor-line')?.innerHTML === '<br>')) {
                    _removePage(pageEl);
                    _reindexPages();
                }

                // The previous page just gained a line — it may now overflow.
                flushReflowNow(pIdx - 1);
            }
        }
    }
}

/** Helper to increase/decrease block indentation. */
function _adjustIndentation(lineEl, direction) {
    if (!lineEl) return;
    const currentPadding = parseInt(lineEl.style.paddingLeft) || 0;
    const newPadding = Math.max(0, currentPadding + (direction * TAB_SIZE));

    if (newPadding > 0) {
        lineEl.style.paddingLeft = newPadding + 'px';
    } else {
        lineEl.style.paddingLeft = '';
    }
    _updateRawText();
}

// ── Cursor Positioning ────────────────────────────────────────────────────────

function _setCursor(lineEl, offset) {
    const sel = window.getSelection();
    const range = document.createRange();

    let charCount = 0;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while (node = walker.nextNode()) {
        if (charCount + node.length >= offset) {
            range.setStart(node, offset - charCount);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        charCount += node.length;
    }

    range.selectNodeContents(lineEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

// ── Serialization ─────────────────────────────────────────────────────────────

/** Serialize all pages back to raw text for storage. */
function _serializePages() {
    const contents = _getPageContents();
    const lines = [];

    contents.forEach(page => {
        Array.from(page.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent.trim()) lines.push(child.textContent);
            } else if (child.tagName === 'IMG') {
                const data = { src: child.src, style: child.getAttribute('style') };
                lines.push(`[[IMG:${JSON.stringify(data)}]]`);
            } else if (child.tagName === 'TABLE') {
                lines.push(child.outerHTML.replace(/\r?\n|\r/g, ' '));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const html = child.innerHTML.replace(/\r?\n|\r/g, ' ');
                const lineStyle = child.getAttribute('style') || '';
                const isEmpty = html === '<br>' || html === '';

                if (lineStyle) {
                    lines.push(`[[STYLE:${lineStyle}]]${isEmpty ? '' : html}`);
                } else {
                    lines.push(isEmpty ? '' : html);
                }
            }
        });
    });

    _rawText = lines.join('\n');
    return _rawText;
}

function _updateRawText() {
    _serializePages();
    syncActiveTabContent(_editor);
}

// ── Page Re-indexing ──────────────────────────────────────────────────────────

function _reindexPages() {
    const pages = _container.querySelectorAll('.editor-page');
    pages.forEach((page, idx) => {
        page.dataset.pageIndex = idx;
    });
}

// ── Automatic Pagination (Reflow) ───────────────────────────────────────────────
// Content that doesn't fit a page's measured height automatically flows onto
// the next page (created if needed); deleting content pulls it back and drops
// empty trailing pages. Two urgency tiers:
//   - "push" (overflow -> next page) runs synchronously on every edit, so
//     there is never a rendered frame with overflowing content sitting in a
//     focused `overflow:hidden` box for the browser to scroll into view
//     (that scroll-follows-caret behavior was the cause of the old "text
//     creeps into the top margin" bug).
//   - "pull-back" (reclaim room from later pages) + empty-page cleanup are
//     debounced, since shrinking content can never trigger that scroll bug.

/** Normal-flow children of a page: excludes floating (position:absolute)
 *  images/tables, which the user has manually positioned and which don't
 *  occupy space in the page's flex layout. */
function _flowChildren(contentEl) {
    return Array.from(contentEl.children).filter(el => getComputedStyle(el).position !== 'absolute');
}

/** Height available to flow children inside a page's padding. */
function _availableHeight(contentEl) {
    const cs = getComputedStyle(contentEl);
    return contentEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}

/** Pure decision function (no DOM access) — given ordered block heights and
 *  the space available, returns the index of the first block that overflows,
 *  or -1 if everything fits. Kept pure so it's unit-testable without a real
 *  browser layout (jsdom can't produce meaningful offsetHeight values). */
function _findOverflowIndex(heights, availableHeight) {
    let sum = 0;
    for (let i = 0; i < heights.length; i++) {
        sum += heights[i];
        if (sum > availableHeight) return i;
    }
    return -1;
}

/** Tier 1: push whatever overflows page `startIdx` onto the next page(s),
 *  creating pages as needed, cascading forward until nothing overflows. */
function _pushOverflow(startIdx) {
    let idx = startIdx;
    let guard = 0;
    while (guard++ < MAX_PAGES) {
        const contents = _getPageContents();
        if (idx < 0 || idx >= contents.length) break;
        const contentEl = contents[idx];

        const flow = _flowChildren(contentEl);
        const heights = flow.map(el => el.offsetHeight); // single read pass, no writes yet
        const cut = _findOverflowIndex(heights, _availableHeight(contentEl));
        contentEl.scrollTop = 0;
        if (cut === -1) break; // this page fits; nothing left to push forward

        if (idx + 1 >= _getPageContents().length) {
            _createPage(idx + 1);
        }
        const nextContent = _getPageContents()[idx + 1];
        const frag = document.createDocumentFragment();
        for (const el of flow.slice(cut)) frag.appendChild(el); // appendChild moves, preserves node identity
        nextContent.insertBefore(frag, nextContent.firstChild);
        nextContent.scrollTop = 0;

        idx++; // the next page may now overflow too — check it next iteration
    }
}

/** Tier 2: pull content back from later pages into earlier ones that have
 *  room, cascading forward, then drop any trailing pages left fully empty.
 *
 *  A page that gets fully drained by this process is removed immediately
 *  (not just at the very end) — otherwise a page that becomes empty in the
 *  MIDDLE of the document (not the last one) would sit there permanently,
 *  since only the final page gets a "no next page" chance to be inspected. */
function _pullBack(startIdx) {
    let idx = Math.max(0, startIdx);
    let guard = 0;
    while (guard++ < MAX_PAGES) {
        const contents = _getPageContents();
        if (idx >= contents.length - 1) break; // no next page to pull from

        const nextContentEl = contents[idx + 1];
        const nextFlow = _flowChildren(nextContentEl);

        if (nextFlow.length === 0) {
            const nextHasFloating = Array.from(nextContentEl.children).some(el => getComputedStyle(el).position === 'absolute');
            if (!nextHasFloating) {
                _removePage(nextContentEl.closest('.editor-page'));
                continue; // retry idx: whatever followed just shifted into idx+1
            }
            idx++; // next page only holds floating content we can't merge away
            continue;
        }

        const contentEl = contents[idx];
        const flow = _flowChildren(contentEl);
        const available = _availableHeight(contentEl);
        let used = flow.reduce((sum, el) => sum + el.offsetHeight, 0); // single read pass

        let pulledAll = true;
        for (const el of nextFlow) {
            const h = el.offsetHeight;
            if (used + h > available) { pulledAll = false; break; }
            contentEl.appendChild(el); // moves node, preserves identity
            used += h;
        }
        contentEl.scrollTop = 0;

        // If everything was pulled, retry the same idx: nextFlow is now
        // empty (handled above next time round) and this page may still
        // have room to reach further. Otherwise this page is as full as
        // it'll get — move to the next pair.
        if (!pulledAll) idx++;
    }
    _removeTrailingEmptyPages(); // catches only the last page in the document, which has no "next" pair to trigger removal above
}

/** Remove trailing pages with no flow content and no floating content,
 *  stopping at the first non-empty one from the end. Never removes page 0. */
function _removeTrailingEmptyPages() {
    const pages = Array.from(_container.querySelectorAll('.editor-page'));
    for (let i = pages.length - 1; i > 0; i--) {
        const contentEl = pages[i].querySelector('.page-content');
        const hasFlow = _flowChildren(contentEl).length > 0;
        const hasFloating = Array.from(contentEl.children).some(el => getComputedStyle(el).position === 'absolute');
        if (hasFlow || hasFloating) break;
        _removePage(pages[i]);
    }
    _reindexPages();
}

/** Run `fn` (which may move DOM nodes between pages) while preserving the
 *  caret. Only the collapsed-caret case is preserved faithfully; a non-
 *  collapsed selection active at reflow time collapses to its anchor. */
function _withCursorPreserved(fn) {
    const sel = window.getSelection();
    let anchorNode = null, anchorOffset = 0, hadFocus = false;

    if (sel && sel.rangeCount > 0) {
        const active = document.activeElement;
        if (active && active.closest && active.closest('.page-content')) {
            anchorNode   = sel.anchorNode;
            anchorOffset = sel.anchorOffset;
            hadFocus     = true;
        }
    }

    fn();

    if (!hadFocus) return;

    if (anchorNode && anchorNode.isConnected) {
        const hostEl = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
        const page   = hostEl?.closest?.('.page-content');
        if (page) {
            page.focus();
            try {
                const range = document.createRange();
                range.setStart(anchorNode, anchorOffset);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch {
                // Offset no longer valid for this node (rare); focus is still correct.
            }
        }
        return;
    }

    // The node the caret was in got removed (e.g. trailing empty page
    // cleanup) — fall back to the end of the last remaining page.
    const contents = _getPageContents();
    const last = contents[contents.length - 1];
    if (last) {
        last.focus();
        const lastBlock = last.lastElementChild;
        if (lastBlock) _setCursor(lastBlock, lastBlock.textContent.length);
    }
}

let _minDirtyPage = Infinity;

const _flushPullBack = debounce(() => {
    const start = _minDirtyPage;
    _minDirtyPage = Infinity;
    if (start === Infinity) return;
    _withCursorPreserved(() => _pullBack(start));
    _updateRawText();
}, PULL_BACK_DEBOUNCE_MS);

/** Call after routine typing: pushes overflow immediately, defers pull-back. */
export function scheduleReflow(fromPageIdx) {
    if (fromPageIdx < 0) return;
    _minDirtyPage = Math.min(_minDirtyPage, fromPageIdx);
    _withCursorPreserved(() => _pushOverflow(fromPageIdx));
    _updateRawText();
    _flushPullBack();
}

/** Call after discrete one-shot actions (paste, add/delete page, drag-
 *  reparent, initial load) where both push and pull-back should happen now. */
export function flushReflowNow(fromPageIdx) {
    if (fromPageIdx < 0) return;
    _minDirtyPage = Math.min(_minDirtyPage, fromPageIdx);
    const start = _minDirtyPage;
    _minDirtyPage = Infinity;
    _withCursorPreserved(() => {
        _pushOverflow(start);
        _pullBack(start);
    });
    _updateRawText();
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Render pages from raw text content. Called when switching tabs. */
export function renderPages(rawTextOverride) {
    if (rawTextOverride !== undefined) {
        _rawText = rawTextOverride;
    }
    _buildPagesFromRawText(_rawText);
}

export function getRawText() { return _rawText; }
