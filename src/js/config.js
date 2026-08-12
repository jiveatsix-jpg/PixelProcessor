// ── PixelProcessor Configuration ──────────────────────────────────────────────
// Change defaults here without touching application logic.

export const PAGE_WIDTH   = 816;   // px  — 8.5 inches at 96 dpi (letter paper)
export const PAGE_HEIGHT  = 1056;  // px  — 11 inches at 96 dpi (letter paper)
export const PAGE_GAP     = 20;    // px  — dark gap between visual pages
export const GRID_CHARS   = 44;    // max characters per line (approx for Press Start 2P at 16px)
export const GRID_LINES   = 40;    // max lines per page (fills 11" page at 24px/line)
export const PDF_W_IN     = 8.5;   // in  — letter width
export const PDF_H_IN     = 11;    // in  — letter height
export const PDF_SCALE    = 2;     // canvas upscale factor for PDF render

export const GIF_SCALE       = 1;  // canvas scale for GIF frames (kept low: many frames x high-res gets slow/huge)
export const GIF_FPS         = 12; // target frames per second for the animation loop
export const GIF_MIN_FRAMES  = 8;  // floor, so very fast animations still look smooth
export const GIF_MAX_FRAMES  = 24; // ceiling, so slow animations don't take forever to render

export const DEFAULT_PALETTE = [
    // Row 1
    '#F0F0F0', '#FF6B6B', '#4ECDC4', '#FFE66D', '#6BCB77', '#4D96FF', '#B1B2FF',
    // Row 2
    '#1A1A2E', '#FF9F43', '#F368E0', '#01CBC6', '#5F27CD', '#00E640', '#C0392B',
];

export const COLOR_GRID_PRESETS = [
    '#F0F0F0', '#000000', '#FF2B2B', '#FFB000', '#FFE66D',
    '#4ECDC4', '#2980B9', '#4D96FF', '#B1B2FF', '#9B59B6',
    '#F368E0', '#FF9F43', '#10AC84', '#01A3A4', '#5F27CD',
    '#54A0FF', '#00E640', '#F1C40F', '#E74C3C', '#2C3E50',
];

export const LS_KEYS = {
    DOCUMENTS     : 'pixelDocuments',
    OLD_CONTENT   : 'pixelWordContent',   // legacy migration
    PALETTE       : 'pixelPalette',
    SAVED_PALETTES: 'pixelSavedPalettes',
    GLOW_COLOR    : 'pixelGlowColor',
    PAGE_MODE     : 'pixelPageMode',
    MARGIN_Y      : 'pixelPageMarginY',
    MARGIN_X      : 'pixelPageMarginX',
};
