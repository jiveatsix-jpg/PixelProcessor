import { $, on } from '../utils/dom.js';
import { LS_KEYS, GRID_CHARS, GRID_LINES } from '../config.js';
import { syncActiveTabContent, registerRawTextGetter } from '../state.js';
import { debounce } from '../utils/debounce.js';

let _editor     = null;
let _container  = null;
let _rawText    = ""; // The source of truth
let _cursorPos  = 0;

const _debouncedRender = debounce(() => render(), 250);

/**
 * Initializes Page Mode.
 */
export function initPageMode(editor) {
    _editor    = editor;
    _container = $('editor-container');
    _container.classList.add('paged-mode');

    const mY = $('page-margin-y');
    const mX = $('page-margin-x');
    if (mY && mX) {
        const updateMargins = () => {
            _container.style.setProperty('--page-padding-y', mY.value + 'px');
            _container.style.setProperty('--page-padding-x', mX.value + 'px');
            render();
        };
        mY.oninput = updateMargins;
        mX.oninput = updateMargins;
    }

    _rawText = _editor.innerText || "";
    registerRawTextGetter(() => _rawText);
    render();

    window.addEventListener('keydown', _handleKeyDown);
    window.addEventListener('input', _handleInput, true);
    window.addEventListener('paste', _handlePaste, true);
}

function _handlePaste(e) {
    // Only intercept if we are inside a page content
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const target = sel.anchorNode.parentElement;
    if (!target.closest('.page-content')) return;

    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
}

export function renderPages(rawTextOverride) {
    if (rawTextOverride !== undefined) {
        _rawText = rawTextOverride;
    } else {
        // Serialize from DOM only when no override given (e.g. margin change)
        const pages = Array.from(_container.querySelectorAll('.page-content'));
        if (pages.length > 0) {
            let lines = [];
            pages.forEach(page => {
                Array.from(page.childNodes).forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        if (child.textContent.trim()) lines.push(child.textContent);
                    } else if (child.tagName === 'TABLE') {
                        lines.push(child.outerHTML);
                    } else if (child.tagName === 'IMG') {
                        lines.push(`[[IMG:${JSON.stringify({src: child.src, style: child.getAttribute('style')})}]]`);
                    } else {
                        const html = child.innerHTML;
                        lines.push(html === '<br>' || html === '' ? '' : html);
                    }
                });
            });
            _rawText = lines.join('\n');
        } else {
            _rawText = _editor.innerText || '';
        }
    }
    render();
}

// ── Layout Engine ─────────────────────────────────────────────────────────────

function _layout(text, dynamicGridLines) {
    const lines = text.split('\n');
    const pages = [[]];
    let currentLinesInPage = 0;

    for (let line of lines) {
        if (line.startsWith('[[IMG:')) {
            const imgHeight = 10;
            if (currentLinesInPage + imgHeight > dynamicGridLines && pages[pages.length - 1].length > 0) {
                pages.push([]);
                currentLinesInPage = 0;
            }
            pages[pages.length - 1].push(line);
            currentLinesInPage += imgHeight;
            continue;
        }

        if (line.trim().startsWith('<table')) {
            // Estimate table height (approx 3 lines per row)
            const rowCount = (line.match(/<tr/g) || []).length;
            const tableHeight = Math.max(4, rowCount * 3); 

            if (currentLinesInPage + tableHeight > dynamicGridLines && pages[pages.length - 1].length > 0) {
                pages.push([]);
                currentLinesInPage = 0;
            }
            pages[pages.length - 1].push(line);
            currentLinesInPage += tableHeight;
            continue;
        }

        const visibleText = line.replace(/<[^>]*>/g, '');
        const estimatedLines = Math.max(1, Math.ceil(visibleText.length / GRID_CHARS));

        if (currentLinesInPage + estimatedLines > dynamicGridLines && pages[pages.length - 1].length > 0) {
            pages.push([]);
            currentLinesInPage = 0;
        }

        pages[pages.length - 1].push(line);
        currentLinesInPage += estimatedLines;
    }

    return pages;
}

function render() {
    const mY = parseInt($('page-margin-y')?.value || 60, 10);
    const availableH = 1056 - (mY * 2);
    const dynamicGridLines = Math.floor(availableH / 24);

    const pages = _layout(_rawText, dynamicGridLines);
    const selection = _saveSelection();

    _container.innerHTML = "";

    pages.forEach((pageLines, pIdx) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'editor-page';
        pageEl.dataset.pageIndex = pIdx;

        const contentEl = document.createElement('div');
        contentEl.className = 'page-content pixel-editor';
        contentEl.contentEditable = 'true';
        contentEl.spellcheck = true;
        contentEl.lang = 'es';

        pageLines.forEach((line) => {
            if (line.startsWith('[[IMG:')) {
                try {
                    const data = JSON.parse(line.slice(6, -2));
                    const img = document.createElement('img');
                    img.src = data.src;
                    img.setAttribute('style', data.style);
                    img.dataset.isMarker = "true";
                    contentEl.appendChild(img);
                } catch (e) {
                    const errorLine = document.createElement('div');
                    errorLine.className = 'editor-line';
                    errorLine.textContent = "[Error al cargar imagen]";
                    contentEl.appendChild(errorLine);
                }
            } else if (line.trim().startsWith('<table')) {
                const wrap = document.createElement('div');
                wrap.innerHTML = line;
                if (wrap.firstChild) contentEl.appendChild(wrap.firstChild);
            } else {
                // Decode optional style prefix: [[STYLE:text-align:justify]]content
                let lineStyle = '';
                let lineContent = line;
                const styleMatch = line.match(/^\[\[STYLE:([^\]]+)\]\](.*)$/s);
                if (styleMatch) {
                    lineStyle   = styleMatch[1];
                    lineContent = styleMatch[2];
                }

                const lineEl = document.createElement('div');
                lineEl.className = 'editor-line';
                if (lineStyle) lineEl.setAttribute('style', lineStyle);
                lineEl.innerHTML = lineContent || '<br>';
                contentEl.appendChild(lineEl);
            }
        });

        pageEl.appendChild(contentEl);
        _container.appendChild(pageEl);

        if (pIdx < pages.length - 1) {
            const gap = document.createElement('div');
            gap.className = 'page-break-divider';
            _container.appendChild(gap);
        }
    });

    _restoreSelection(selection);
    _syncToEditor();
}

// ── Event Handlers ────────────────────────────────────────────────────────────

function _handleInput(e) {
    const pages = Array.from(_container.querySelectorAll('.page-content'));
    let newRawText = [];

    pages.forEach(page => {
        const children = Array.from(page.childNodes);
        children.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent.trim()) newRawText.push(child.textContent);
                return;
            }
            
            if (child.tagName === 'IMG') {
                const data = { src: child.src, style: child.getAttribute('style') };
                newRawText.push(`[[IMG:${JSON.stringify(data)}]]`);
            } else if (child.tagName === 'TABLE') {
                newRawText.push(child.outerHTML);
            } else {
                const html = child.innerHTML;
                const lineStyle = child.getAttribute('style') || '';
                const isEmpty = html === '<br>' || html === '';

                if (lineStyle) {
                    // Encode style prefix so alignment/etc survive re-render
                    newRawText.push(`[[STYLE:${lineStyle}]]${isEmpty ? '' : html}`);
                } else {
                    newRawText.push(isEmpty ? '' : html);
                }
            }
        });
    });

    _rawText = newRawText.join('\n');
    _debouncedRender();
}

function _handleKeyDown(e) {
    const sel = window.getSelection();
    if (sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
    const contentEl = node.closest('.page-content');
    if (!contentEl) return;

    const pageEl = contentEl.parentElement;
    // ── Tab: Indentation ──────────────────────────────────────────────────
    if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '\t');
    }

    // ── ArrowDown: Jump to next page if at last line ───────────────────────
    if (e.key === 'ArrowDown') {
        const lineEl = node.closest('.editor-line');
        if (lineEl && !lineEl.nextElementSibling) {
            const nextPage = _container.querySelector(`.editor-page[data-page-index="${pIdx + 1}"]`);
            if (nextPage) {
                e.preventDefault();
                const firstLine = nextPage.querySelector('.editor-line');
                _setCursor(firstLine, 0);
            }
        }
    }

    // ── ArrowUp: Jump to prev page if at first line ────────────────────────
    if (e.key === 'ArrowUp') {
        const lineEl = node.closest('.editor-line');
        if (lineEl && !lineEl.previousElementSibling) {
            const prevPage = _container.querySelector(`.editor-page[data-page-index="${pIdx - 1}"]`);
            if (prevPage) {
                e.preventDefault();
                const lines = prevPage.querySelectorAll('.editor-line');
                const lastLine = lines[lines.length - 1];
                _setCursor(lastLine, lastLine.textContent.length);
            }
        }
    }

    // ── Backspace: Merge across page boundary ──────────────────────────────
    if (e.key === 'Backspace' && range.collapsed && range.startOffset === 0) {
        const lineEl = node.closest('.editor-line');
        if (lineEl && !lineEl.previousElementSibling && pIdx > 0) {
            e.preventDefault();
            const prevPage = _container.querySelector(`.editor-page[data-page-index="${pIdx - 1}"]`);
            const lines = prevPage.querySelectorAll('.editor-line');
            const lastLine = lines[lines.length - 1];
            _setCursor(lastLine, lastLine.textContent.length);
        }
    }
}

// ── Selection Persistence ─────────────────────────────────────────────────────

function _saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);

    const lineEl = range.startContainer.closest?.('.editor-line') || range.startContainer.parentElement?.closest('.editor-line');
    if (!lineEl) return null;

    const allLines = Array.from(_container.querySelectorAll('.editor-line'));
    const lineIndex = allLines.indexOf(lineEl);

    // Calculate offset within line, ignoring HTML tags
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
        // Fallback to last line if index vanished
        if (allLines.length > 0) _setCursorInLine(allLines[allLines.length-1], 0);
        return;
    }
    _setCursorInLine(lineEl, saved.offset);
}

function _setCursorInLine(lineEl, offset) {
    const sel = window.getSelection();
    const range = document.createRange();
    
    let charCount = 0;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    
    while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (charCount + node.length >= offset) {
                range.setStart(node, offset - charCount);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
            charCount += node.length;
        } else if (node.tagName === 'BR' && charCount >= offset) {
            range.setStartBefore(node);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
    }
    
    // Fallback: end of line
    range.selectNodeContents(lineEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function _syncToEditor() {
    _editor.innerText = _rawText;
    syncActiveTabContent(_editor);
}

export function getRawText() { return _rawText; }
export function repaginate() {}
export function clearRepagination() {}
