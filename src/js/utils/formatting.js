// ── Formatting Commands (Selection/Range API — no execCommand) ────────────────
// Modern replacement for document.execCommand using native Selection API.

/** Get the current selection range, or null if none/collapsed. */
function _getRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.getRangeAt(0).collapsed) return null;
    return sel.getRangeAt(0);
}

/** Check if the current selection (or cursor position) is inside a tag. */
function _isInsideTag(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node) {
        if (node.tagName?.toLowerCase() === tagName.toLowerCase()) return true;
        node = node.parentElement;
    }
    return false;
}

/** Wrap all inline elements in the range with a new element. */
function _wrapRange(tag, styles = {}) {
    const range = _getRange();
    if (!range) return;

    const frag = range.extractContents();
    const el = document.createElement(tag);
    Object.entries(styles).forEach(([k, v]) => {
        if (k.startsWith('--')) {
            el.style.setProperty(k, v);
        } else {
            el.style[k] = v;
        }
    });
    el.appendChild(frag);
    range.insertNode(el);
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

/** Apply an inline style to the current selection. */
function _applyStyle(property, value) {
    const range = _getRange();
    if (!range) return;

    const commonAncestor = range.commonAncestorContainer;
    const node = commonAncestor.nodeType === Node.TEXT_NODE
        ? commonAncestor.parentElement
        : commonAncestor;

    // If selection is entirely within a single element, apply style directly
    if (node && node !== range.commonAncestorContainer) {
        node.style[property] = value;
        return;
    }

    // Otherwise wrap the selection
    _wrapRange('span', { [property]: value });
}

/** Apply a font name to the selection. */
function _applyFontName(fontFamily) {
    _wrapRange('span', { fontFamily });
}

/** Apply a font size (1-7 scale mapped to px). */
function _applyFontSize(size) {
    const sizeMap = { '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
    _wrapRange('span', { fontSize: sizeMap[size] || '16px' });
}

/** Toggle bold on the current selection. */
function _toggleBold() {
    if (_isInsideTag('strong') || _isInsideTag('b')) {
        _unwrapTag('strong');
        _unwrapTag('b');
    } else {
        _wrapRange('strong');
    }
}

/** Toggle italic on the current selection. */
function _toggleItalic() {
    if (_isInsideTag('em') || _isInsideTag('i')) {
        _unwrapTag('em');
        _unwrapTag('i');
    } else {
        _wrapRange('em');
    }
}

/** Remove wrappers of a specific tag from the selection area. */
function _unwrapTag(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const node = sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : sel.anchorNode;

    let el = node;
    while (el) {
        if (el.tagName?.toLowerCase() === tagName.toLowerCase()) {
            const parent = el.parentNode;
            while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
            // Normalize to merge adjacent text nodes
            parent.normalize();
            return;
        }
        el = el.parentElement;
    }
}

/** Apply text alignment to the closest block-level element. */
function _applyAlignment(value) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const block = node.closest?.('.editor-line, p, div, th, td, .page-content');
    if (block) {
        block.style.textAlign = value;
    }
}

/** Apply highlight color to selection. */
function _applyHighlight(color) {
    _wrapRange('mark', { backgroundColor: color });
}

/** Apply foreground color to selection. */
function _applyForeColor(color) {
    _wrapRange('span', { color });
}

/** Execute a formatting command (mimics execCommand interface). */
export function formatCommand(cmd, value = null) {
    switch (cmd.toLowerCase()) {
        case 'bold':
            _toggleBold();
            break;
        case 'italic':
            _toggleItalic();
            break;
        case 'underline':
            if (_isInsideTag('u')) _unwrapTag('u');
            else _wrapRange('u');
            break;
        case 'forecolor':
            _applyForeColor(value || '#F0F0F0');
            break;
        case 'hilitecolor':
        case 'backcolor':
            _applyHighlight(value || 'yellow');
            break;
        case 'justifyleft':
            _applyAlignment('left');
            break;
        case 'justifycenter':
            _applyAlignment('center');
            break;
        case 'justifyright':
            _applyAlignment('right');
            break;
        case 'justifyfull':
            _applyAlignment('justify');
            break;
        case 'fontname':
            _applyFontName(value);
            break;
        case 'fontsize':
            _applyFontSize(value);
            break;
        case 'undo':
        case 'redo':
            // Browser native undo/redo still works
            document.execCommand(cmd, false, null);
            break;
        case 'inserthtml':
            _insertHTML(value);
            break;
        default:
            // Fallback for unsupported commands
            document.execCommand(cmd, false, value);
            break;
    }
}

/** Insert HTML at cursor position. */
function _insertHTML(html) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
    }

    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}
