// ── Page Mode Engine (Manual pages) ────────────────────────────────────────────
// Each page is a fixed-size contentEditable div. No auto-overflow splitting.
// User clicks "Add Page" to create a new blank page.
// Pages clip overflow — content beyond the page bottom is hidden.

import { $ } from '../utils/dom.js';
import { syncActiveTabContent, registerRawTextGetter } from '../state.js';

let _editor    = null;
let _container = null;
let _rawText   = '';

const TAB_SIZE = 40; // 40px tab stops
const MAX_LINES = 38; // max .editor-line children per page (934px / 24px)

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

// ── Observers ─────────────────────────────────────────────────────────────────

/** Watch for new children (created by contentEditable Enter) and
 *  ensure they get the .editor-line class for styling. */
function _observePage(contentEl) {
    const childObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Add .editor-line to new direct children
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node.parentElement === contentEl) {
                        node.classList.add('editor-line');
                    }
                }
            }
        }
        // Enforce MAX_LINES — remove excess lines from the END
        const lines = [...contentEl.querySelectorAll('.editor-line')];
        if (lines.length > MAX_LINES) {
            for (let i = MAX_LINES; i < lines.length; i++) {
                lines[i].remove();
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
    _updateRawText();
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
    _updateRawText();
}

// ── Initial Page Build ────────────────────────────────────────────────────────

/** Build pages from raw text (on load or tab switch). */
function _buildPagesFromRawText(rawText) {
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
}

function _handleInput(e) {
    const contentEl = e.target.closest?.('.page-content');
    if (!contentEl) return;
    _updateRawText();
}

function _handlePaste(e) {
    const contentEl = e.target.closest?.('.page-content');
    if (!contentEl) return;

    e.preventDefault();

    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;

    let lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // Strip trailing empty element from trailing newline
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) return;

    // Check limit BEFORE inserting
    const currentLines = contentEl.querySelectorAll('.editor-line').length;
    const allowed = MAX_LINES - currentLines;
    if (allowed <= 0) return;
    if (lines.length > allowed) lines = lines.slice(0, allowed);

    // Get current line at cursor
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
    const currentLine = startNode.closest('.editor-line');
    if (!currentLine) return;

    // Save text before / after cursor (for splitting the current line)
    const textBefore = currentLine.textContent.slice(0, range.startOffset);
    const textAfter  = currentLine.textContent.slice(range.startOffset);
    currentLine.textContent = textBefore;

    // Create new line elements
    const frag = document.createDocumentFragment();
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

    // Append remaining text after cursor to LAST pasted line
    if (textAfter) {
        const last = frag.lastChild;
        if (last) last.textContent += textAfter;
    }

    // Insert after current line
    const nextSibling = currentLine.nextElementSibling;
    contentEl.insertBefore(frag, nextSibling);

    // Move cursor to end of last pasted line
    const linesEls = contentEl.querySelectorAll('.editor-line');
    const lastLine = linesEls[linesEls.length - 1];
    if (lastLine) _setCursor(lastLine, lastLine.textContent.length);

    _updateRawText();
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

    // Enter: block if page already has MAX_LINES
    if (e.key === 'Enter' && !e.shiftKey) {
        const lineCount = contentEl.querySelectorAll('.editor-line').length;
        console.log(`[PAGE] Enter pressed, lineCount=${lineCount}, MAX=${MAX_LINES}, block=${lineCount >= MAX_LINES}`);
        if (lineCount >= MAX_LINES) {
            e.preventDefault();
            return;
        }
    }

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

    const contentEl = range.startContainer.closest?.('.page-content');
    if (!contentEl) return null;

    let childEl = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;

    while (childEl && childEl.parentElement !== contentEl && childEl.parentElement?.closest('.page-content')) {
        childEl = childEl.parentElement;
    }
    if (!childEl || childEl.parentElement !== contentEl) return null;

    const allChildren = Array.from(_container.querySelectorAll('.page-content > *'));
    const childIndex = allChildren.indexOf(childEl);
    if (childIndex === -1) return null;

    const preRange = range.cloneRange();
    preRange.selectNodeContents(childEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const offset = preRange.toString().length;

    return { childIndex, offset };
}

function _restoreSelection(saved) {
    if (!saved) return;

    const allChildren = Array.from(_container.querySelectorAll('.page-content > *'));
    const lineEl = allChildren[saved.childIndex];
    if (!lineEl) {
        const last = allChildren[allChildren.length - 1];
        if (last) _setCursor(last, last.textContent.length);
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

// ── Public API ────────────────────────────────────────────────────────────────

/** Render pages from raw text content. Called when switching tabs. */
export function renderPages(rawTextOverride) {
    if (rawTextOverride !== undefined) {
        _rawText = rawTextOverride;
    }
    _buildPagesFromRawText(_rawText);
}

export function getRawText() { return _rawText; }
export function repaginate() { /* no-op: manual pages */ }
export function clearRepagination() { /* no-op */ }
