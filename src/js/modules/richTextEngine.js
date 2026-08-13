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

/** camelCase -> kebab-case for a CSS property name (custom properties, which
 *  are already kebab-case-ish and case-sensitive, pass through untouched). */
function _cssPropName(key) {
    return key.startsWith('--') ? key : key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

/** Wrap all inline elements in the range with a new element.
 *
 *  Inserts via document.execCommand('insertHTML', ...) rather than manually
 *  mutating the range (extractContents/insertNode/appendChild) — manual DOM
 *  mutation is invisible to the browser's native undo manager and
 *  permanently breaks Ctrl+Z/Ctrl+Y for the rest of the editing session the
 *  first time it happens.
 *
 *  Only plain CSS properties survive this (color, background-color,
 *  font-family, font-size, text-decoration...) — the browser's insertHTML
 *  sanitizer silently drops any element whose only styling it doesn't
 *  recognize (custom properties, text-shadow, animation, class names with
 *  no matching declared style), so this path is not used for effects that
 *  need those (see wrapSelection in utils/dom.js). */
function _wrapRange(tag, styles = {}) {
    const range = _getRange();
    if (!range) return;

    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    const styleStr = Object.entries(styles)
        .map(([k, v]) => `${_cssPropName(k)}:${v}`)
        .join(';');

    document.execCommand('insertHTML', false, `<${tag} style="${styleStr}">${container.innerHTML}</${tag}>`);
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

/** Remove wrappers of a specific tag from the selection area, via
 *  execCommand so the undo history isn't broken by a manual DOM mutation
 *  (see _wrapRange above for why that matters). */
function _unwrapTag(tagName) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const node = sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : sel.anchorNode;

    let el = node;
    while (el) {
        if (el.tagName?.toLowerCase() === tagName.toLowerCase()) {
            const range = document.createRange();
            range.selectNode(el);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('insertHTML', false, el.innerHTML);
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

/** Closest ancestor (from the current selection's anchor) with the given
 *  inline style property already set, or null. Used so re-applying
 *  highlight/color toggles or recolors in place instead of always nesting a
 *  new wrapper inside whatever's already there. */
function _selectionAncestorWithStyle(property) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
        if (node.style?.[property]) return node;
        node = node.parentElement;
    }
    return null;
}

/** Normalizes any CSS color string (name, hex, rgb()) via canvas so two
 *  different-looking values (e.g. 'yellow' vs 'rgb(255, 255, 0)') can be
 *  compared for equality. */
let _colorCtx = null;
function _normalizeColor(color) {
    _colorCtx = _colorCtx || document.createElement('canvas').getContext('2d');
    _colorCtx.fillStyle = '#000000';
    _colorCtx.fillStyle = color;
    return _colorCtx.fillStyle;
}

/** Replaces `el` with its own contents via execCommand, so the undo history
 *  isn't broken by a manual DOM mutation (see _wrapRange for why). */
function _unwrapElement(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertHTML', false, el.innerHTML);
}

/** Apply highlight color to selection — toggles off if the same color is
 *  re-applied to already-highlighted text, or recolors it in place if a
 *  different color was picked, instead of nesting a second wrapper. */
function _applyHighlight(color) {
    const existing = _selectionAncestorWithStyle('backgroundColor');
    if (existing) {
        if (_normalizeColor(existing.style.backgroundColor) === _normalizeColor(color)) {
            _unwrapElement(existing);
        } else {
            existing.style.backgroundColor = color;
        }
        return;
    }
    _wrapRange('mark', { backgroundColor: color });
}

/** Apply foreground color to selection — recolors in place if the
 *  selection is already inside a colored span, instead of nesting a
 *  second wrapper around it. */
function _applyForeColor(color) {
    const existing = _selectionAncestorWithStyle('color');
    if (existing) {
        existing.style.color = color;
        return;
    }
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
