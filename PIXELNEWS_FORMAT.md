# PixelNews `.pxp` Article Format

Canonical reference for generating PixelProcessor `.pxp` articles by hand or by
script (see `scripts/make-pxp.js`). This format was hand-validated in-app —
injected directly into the live DOM and exported to PDF via the real export
button — before being wired into the headless pipeline. Do not deviate from it
without re-validating.

## 1. File shape

A `.pxp` file is JSON with exactly two fields:

```json
{
  "title": "Document title / tab name",
  "content": "<newline-delimited pseudo-format, see below>"
}
```

`content` is parsed line-by-line by `_appendLine()` in
`src/js/modules/pageMode.js`. Each line falls into exactly one of these
categories, checked in this order:

### `[[STYLE:<css>]]<html>`
Sets `<css>` as the inline `style` attribute of the line's wrapping
`<div class="editor-line">`, with everything after the closing `]]` used as
that div's `innerHTML`. This is the standard way to write a paragraph:

```
[[STYLE:text-align: justify;]]Plain paragraph text.
```

An empty line, or a `[[STYLE:...]]` line whose HTML part is empty, renders as
`<br>` — use it for paragraph spacing between lines.

### `[[IMG:{...json...}]]`
Inserts an image. The JSON has a required `src` and optional `style`:

```
[[IMG:{"src":"data:image/png;base64,...","style":"max-width:100%;"}]]
```

### `<table...`
A line starting with `<table` is inserted as raw HTML and parsed as a table
element.

### Anything else
Becomes `<div class="editor-line">innerHTML</div>` directly. Inline HTML tags
(`<b>`, `<span style="...">`, etc.) work here, but this form has no
`text-align` styling — prefer `[[STYLE:...]]` for real body text.

## 2. Known rendering bug — do not use `<font size>`

`<font size="N">` (the legacy tag `execCommand('fontSize')` produces) for
large `N` (5–7) causes vertical overlap between wrapped lines in the exported
PDF: the pagination/line-height system does not account for oversized inline
fonts.

**Never generate `<font size>` for titles or emphasis.** The validated
working pattern for visual hierarchy is: keep the default font size
everywhere, and use `<span style="color: rgb(R,G,B);">` (optionally wrapped
in `<b>`) to color the headline and key phrases. This renders correctly with
no overlap.

Validated headline line:

```
[[STYLE:text-align: justify;]]<span style="color: rgb(1, 203, 198);"><b>Headline text here</b></span>
```

Validated body paragraph with a highlighted phrase:

```
[[STYLE:text-align: justify;]]Body text here with a <span style="color: rgb(243, 104, 224);">highlighted phrase</span> inside it.
```

### Suggested palette

Validated visually against the app's pixel-art dark theme:

| Role                        | Color                 |
|------------------------------|------------------------|
| Headline / signature accent  | `rgb(1, 203, 198)` (cyan) |
| Inline highlight              | `rgb(243, 104, 224)` (magenta) |
| Default body text             | no span — inherits theme default |

## 3. Structured input shape (for `scripts/make-pxp.js`)

To avoid hand-writing the pseudo-format, `make-pxp.js` takes a structured
JSON description and compiles it into a valid `.pxp` file:

```json
{
  "title": "Document title / tab name",
  "headline": "The big colored headline text",
  "paragraphs": [
    { "text": "Plain paragraph text with {{highlight:some phrase}} inline markers." }
  ],
  "signature": "— Pixel News"
}
```

Fields:

- `title` (string, required) — becomes the `.pxp` tab title.
- `headline` (string, required) — rendered as a justified, bold, cyan
  (`rgb(1, 203, 198)`) line, followed by a blank spacer line.
- `paragraphs` (array of `{ text }`, required) — each rendered as one
  justified line, followed by a blank spacer line. `text` is escaped for HTML
  and may contain any number of `{{highlight:phrase}}` markers.
- `signature` (string, optional) — rendered as a justified, bold, cyan line
  at the end, with no trailing blank line needed.

### Highlight marker convention

Inside `paragraphs[].text`, wrap any phrase that should render as a magenta
highlight in `{{highlight:...}}`:

```
"Android {{highlight:5.0}} and iOS {{highlight:15.1}} are the cutoffs."
```

`make-pxp.js` replaces every `{{highlight:phrase}}` with
`<span style="color: rgb(243, 104, 224);">phrase</span>` and HTML-escapes the
surrounding plain text (but not the phrase's own markup, since the phrase
itself is expected to be plain text too — do not nest markers or raw HTML
inside a highlight marker).
