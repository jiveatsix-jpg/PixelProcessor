#!/usr/bin/env node
// ── make-pxp.js ────────────────────────────────────────────────────────────
// Compiles a structured article description (JSON) into a PixelProcessor
// .pxp file ({ title, content }, content following the pseudo-format
// documented in PIXELNEWS_FORMAT.md at the repo root).
//
// Usage: node scripts/make-pxp.js input.json output.pxp

// Repo package.json sets "type": "module", so this is loaded as ESM.
import fs from 'fs';

const HEADLINE_COLOR   = 'rgb(1, 203, 198)';   // cyan  — headline & signature
const HIGHLIGHT_COLOR  = 'rgb(243, 104, 224)'; // magenta — inline highlights
const JUSTIFY_STYLE    = 'text-align: justify;';

// ── HTML escaping (applied to plain text before inline markup is added) ────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Expand {{highlight:phrase}} markers into colored spans ──────────────────
// Plain text around the markers is HTML-escaped; the highlighted phrase
// itself is expected to be plain text too (no nested markers/raw HTML).
function renderHighlights(text) {
    const re = /\{\{highlight:([^}]*)\}\}/g;
    let result = '';
    let lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, match.index));
        result += `<span style="color: ${HIGHLIGHT_COLOR};">${escapeHtml(match[1])}</span>`;
        lastIndex = re.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
}

function styledLine(html) {
    return `[[STYLE:${JUSTIFY_STYLE}]]${html}`;
}

function buildContent(article) {
    const lines = [];

    if (article.headline) {
        lines.push(styledLine(`<span style="color: ${HEADLINE_COLOR};"><b>${escapeHtml(article.headline)}</b></span>`));
        lines.push(''); // spacer
    }

    for (const para of article.paragraphs || []) {
        lines.push(styledLine(renderHighlights(para.text || '')));
        lines.push(''); // spacer
    }

    if (article.signature) {
        lines.push(styledLine(`<span style="color: ${HEADLINE_COLOR};"><b>${escapeHtml(article.signature)}</b></span>`));
    }

    return lines.join('\n');
}

function main() {
    const [, , inputPath, outputPath] = process.argv;
    if (!inputPath || !outputPath) {
        console.error('Usage: node scripts/make-pxp.js input.json output.pxp');
        process.exit(1);
    }

    const article = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    if (!article.title) {
        console.error('Input JSON must have a "title" field.');
        process.exit(1);
    }

    const pxp = {
        title: article.title,
        content: buildContent(article),
    };

    fs.writeFileSync(outputPath, JSON.stringify(pxp), 'utf8');
    console.log(`Wrote ${outputPath}`);
}

main();
