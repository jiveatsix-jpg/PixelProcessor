// ── Page Mode Engine (ResizeObserver-based) ───────────────────────────────────
// Each page is a real contentEditable div. The browser does the actual layout.
// ResizeObserver detects overflow, and content is moved between pages.
// No estimation, no heuristics — pure DOM measurement.

import { $ } from '../utils/dom.js';
import { syncActiveTabContent, registerRawTextGetter } from '../state.js';
import { debounce } from '../utils/debounce.js';

let _editor    = null;
let _container = null;
let _observers = new Map(); // pageEl → ResizeObserver
let _rawText   = '';

const TAB_SIZE    = 40; // 40px tab stops
const PAGE_HEIGHT = 1056; // 11 inches at 96 DPI
const DEBOUNCE_MS = 100;  // faster debounce since we're not re-rendering DOM

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
        mY.oninput = () => { _applyMargins(mY.value, mX.value); _recheckAllPages(); };
        mX.oninput = () => { _applyMargins(mY.value, mX.value); };
    }

    // Build initial page structure from saved content
    _buildPagesFromRawText(_editor.innerText || '');
    registerRawTextGetter(() => _serializePages());

    // Bind input events to all page content areas
    _bindPageEvents();
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
    contentEl.contentEditable = 'true';
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
    if (contentEl && _observers.has(contentEl)) {
        _observers.get(contentEl).disconnect();
        _observers.delete(contentEl);
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

// ── ResizeObserver ────────────────────────────────────────────────────────────

/** Observe a page content area for overflow/underflow. */
function _observePage(contentEl) {
    const observer = new ResizeObserver(() => {
        _debouncedCheckOverflow(contentEl);
    });
    observer.observe(contentEl);
    _observers.set(contentEl, observer);
}

const _debouncedCheckOverflow = debounce((contentEl) => {
    _checkOverflow(contentEl);
}, DEBOUNCE_MS);

/** Check if a page overflows and rebalance content. */
function _checkOverflow(contentEl) {
    if (!contentEl.isConnected) return;

    const scrollH = contentEl.scrollHeight;
    const clientH = contentEl.clientHeight;

    if (scrollH > clientH + 2) { // 2px tolerance for sub-pixel rendering
        _overflowToNext(contentEl);
    } else if (scrollH < clientH * 0.5 && contentEl.children.length <= 1) {
        // Page is nearly empty — try to merge with previous
        _mergeWithPrevious(contentEl);
    }
}

/** Move overflowing content from current page to next page. */
function _overflowToNext(contentEl) {
    const children = Array.from(contentEl.children);
    if (children.length <= 1) return; // nothing to move

    // Find the first child that causes overflow using binary-like scan
    let overflowStart = children.length - 1;
    for (let i = children.length - 1; i >= 0; i--) {
        // Temporarily hide children from i onwards and check
        const child = children[i];

        // Check if this specific child crosses the boundary
        const childBottom = child.offsetTop + child.offsetHeight;
        if (childBottom > contentEl.clientHeight) {
            overflowStart = i;
        } else {
            break; // found the boundary
        }
    }

    // Don't move if only the first child overflows (means content is too big)
    if (overflowStart === 0 && children.length === 1) return;

    // Check if we should move tables/images as atomic blocks
    // If the overflow element is part of a table, move the entire table
    if (overflowStart > 0) {
        const prevEl = children[overflowStart - 1];
        if (prevEl.tagName === 'TABLE' || prevEl.tagName === 'IMG') {
            // Move the table/image too if it's the one before overflow start
            overflowStart--;
        }
    }

    const elementsToMove = children.slice(overflowStart);
    if (elementsToMove.length === 0) return;

    // Get or create next page
    const pageEl = contentEl.closest('.editor-page');
    const pages = Array.from(_container.querySelectorAll('.editor-page'));
    const idx = pages.indexOf(pageEl);
    let nextPageContent;

    if (idx + 1 < pages.length) {
        nextPageContent = pages[idx + 1].querySelector('.page-content');
    } else {
        nextPageContent = _createPage(idx + 1);
    }

    // Save selection before DOM mutation
    const sel = _saveSelection();

    // Move elements to next page (maintain order)
    const firstInNext = nextPageContent.firstChild;
    elementsToMove.forEach(el => {
        nextPageContent.insertBefore(el, firstInNext);
    });

    _restoreSelection(sel);
    _updateRawText();

    // Check if next page now overflows (cascade)
    _checkOverflow(nextPageContent);
}

/** Try to merge content from a page into the previous page. */
function _mergeWithPrevious(contentEl) {
    const pageEl = contentEl.closest('.editor-page');
    const pages = Array.from(_container.querySelectorAll('.editor-page'));
    const idx = pages.indexOf(pageEl);
    if (idx <= 0) return; // first page, can't merge up

    const prevPage = pages[idx - 1];
    const prevContent = prevPage.querySelector('.page-content');

    // Check if merging would overflow previous page
    const totalNeeded = prevContent.scrollHeight + contentEl.scrollHeight;
    if (totalNeeded > prevContent.clientHeight + 2) return; // would overflow

    const sel = _saveSelection();

    // Move all children to previous page
    while (contentEl.firstChild) {
        prevContent.appendChild(contentEl.firstChild);
    }

    _removePage(pageEl);
    _reindexPages();
    _restoreSelection(sel);
    _updateRawText();
}

// ── Initial Page Build ────────────────────────────────────────────────────────

/** Build pages from raw text (on load or tab switch). */
function _buildPagesFromRawText(rawText) {
    // Clear existing pages
    const existing = _container.querySelectorAll('.editor-page, .page-break-divider');
    existing.forEach(el => el.remove());
    _observers.forEach(obs => obs.disconnect());
    _observers.clear();

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

    // Recheck overflow (may create additional pages)
    _checkOverflow(firstPage);
    _updateRawText();
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

    // Selection tracking for table module
    _container.addEventListener('keyup', () => {});
    _container.addEventListener('mouseup', () => {});
    _container.addEventListener('click', () => {});
}

function _handlePaste(e) {
    const target = e.target;
    if (!target?.classList?.contains('page-content')) return;

    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
}

function _handleInput(e) {
    const target = e.target;
    if (!target?.classList?.contains('page-content')) return;

    _updateRawText();
    _debouncedCheckOverflow(target);
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
        
        // Improved start-of-line detection: check absolute text offset within the line
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

    // Backspace at start of first line: merge with previous page or reduce indentation
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

        // Otherwise, standard merge logic
        if (lineEl && !lineEl.previousElementSibling && pIdx > 0) {
            e.preventDefault();
            const prevPage = pages[pIdx - 1];
            const prevContent = prevPage.querySelector('.page-content');
            const lines = prevContent.querySelectorAll('.editor-line');
            const lastLine = lines[lines.length - 1];

            if (lastLine) {
                const cursorPos = lastLine.textContent.length;
                // Move current page's first line to previous page
                const firstLine = contentEl.querySelector('.editor-line');
                if (firstLine) {
                    prevContent.appendChild(firstLine);
                }
                _setCursor(lastLine, cursorPos);
                _checkOverflow(prevContent);
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

// ── Selection Persistence ─────────────────────────────────────────────────────

function _saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);

    const lineEl = range.startContainer.closest?.('.editor-line')
        || range.startContainer.parentElement?.closest('.editor-line');
    if (!lineEl) return null;

    const allLines = Array.from(_container.querySelectorAll('.editor-line'));
    const lineIndex = allLines.indexOf(lineEl);

    const preRange = range.cloneRange();
    preRange.selectNodeContents(lineEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const offset = preRange.toString().length;

    return { lineIndex, offset };
}

function _restoreSelection(saved) {
    if (!saved) return;
    const allLines = Array.from(_container.querySelectorAll('.editor-line'));
    const lineEl = allLines[saved.lineIndex];
    if (!lineEl) {
        if (allLines.length > 0) _setCursor(allLines[allLines.length - 1], 0);
        return;
    }
    _setCursor(lineEl, saved.offset);
}

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
                // Remove newlines from table HTML to avoid breaking the line-based format
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

/** Recheck all pages for overflow (e.g. after margin change). */
function _recheckAllPages() {
    const contents = _getPageContents();
    contents.forEach(content => _checkOverflow(content));
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
export function repaginate() { _recheckAllPages(); }
export function clearRepagination() {} // no-op in new engine
