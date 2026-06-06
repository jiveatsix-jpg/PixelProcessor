// ── CSV Import / Export ───────────────────────────────────────────────────────

/** Parse CSV text into array of rows (each row is an array of cells) */
export function parseCSV(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
        } else if (ch === '\n' && !inQuotes) {
            lines.push(current);
            current = '';
        } else if (ch === '\r' && !inQuotes) {
            // skip carriage return outside quotes
        } else {
            current += ch;
        }
    }
    if (current || (!text.endsWith('\n') && current === '' && lines.length > 0)) {
        // Only push non-empty last line, or empty line if file ends with newline
        if (current !== '' || !text.endsWith('\n')) lines.push(current);
    }

    return lines.map(line => _parseLine(line));
}

function _parseLine(line) {
    const cells = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (q && i + 1 < line.length && line[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                q = !q;
            }
        } else if (ch === ',' && !q) {
            cells.push(cell);
            cell = '';
        } else {
            cell += ch;
        }
    }
    cells.push(cell);

    // Strip one layer of outer quotes from each cell and trim
    return cells.map(c => {
        const trimmed = c.trim();
        if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    });
}

/** Serialize headers + rows to CSV string */
export function toCSV(headers, rows) {
    const esc = cell => {
        const s = String(cell == null ? '' : cell);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };

    const lines = [headers.map(esc).join(',')];
    rows.forEach(row => lines.push(row.map(esc).join(',')));
    return lines.join('\r\n');
}
