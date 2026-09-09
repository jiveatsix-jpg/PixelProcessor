// ── Modo Info ─────────────────────────────────────────────────────────────────
// Toggle opcional: cuando está activo, pasar el mouse sobre un control conocido
// muestra un cuadro con una explicación de qué hace. Pensado para cubrir lo que
// el tutorial de bienvenida no llega a explicar en detalle.

import { LS_KEYS } from '../config.js';

const INFO_MAP = {
    'btn-new': 'Crea un documento de texto nuevo y vacío.',
    'btn-new-grid': 'Crea una hoja de cálculo nueva, con filas y columnas editables.',
    'btn-open-file': 'Abre un archivo .PXP guardado previamente.',
    'btn-save': 'Guarda el documento actual en este navegador.',
    'btn-save-pxp': 'Descarga el documento actual como archivo .pxp para abrirlo más tarde con Open PXP.',
    'btn-import-txt': 'Importa el contenido de un archivo .txt como documento nuevo.',
    'btn-export': 'Exporta el documento actual como archivo .txt.',
    'btn-export-pdf': 'Exporta el documento actual como archivo .pdf, respetando páginas y estilos.',
    'btn-export-gif': 'Exporta la página actual como GIF animado, mostrando los efectos de color en movimiento.',
    'btn-undo': 'Deshace el último cambio (Ctrl+Z).',
    'btn-redo': 'Rehace el último cambio deshecho (Ctrl+Y).',
    'btn-bold': 'Aplica negrita al texto seleccionado.',
    'btn-italic': 'Aplica cursiva al texto seleccionado.',
    'btn-highlight': 'Resalta el fondo del texto seleccionado en amarillo.',
    'btn-punct-color': 'Colorea solo los signos de puntuación de la selección (coma, punto, comillas, etc.).',
    'btn-punct-config': 'Configura qué caracteres colorea el botón de puntuación.',
    'palette-select': 'Elige una paleta de colores guardada para usarla en el selector.',
    'btn-save-palette': 'Guarda la paleta de colores actual con un nombre, para reutilizarla después.',
    'btn-delete-palette': 'Elimina la paleta seleccionada de la lista.',
    'btn-align-left': 'Alinea el párrafo a la izquierda.',
    'btn-align-center': 'Centra el párrafo.',
    'btn-align-right': 'Alinea el párrafo a la derecha.',
    'btn-align-justify': 'Justifica el párrafo.',
    'font-family': 'Selecciona la fuente del texto.',
    'font-size': 'Selecciona el tamaño del texto, en una escala de 1 a 7.',
    'btn-apply-anim': 'Aplica a la selección una animación de color (chroma) entre los dos colores elegidos.',
    'btn-glow-toggle': 'Aplica o quita un efecto de brillo (glow) al texto seleccionado, con el color de al lado.',
    'btn-outline-toggle': 'Aplica o quita un contorno al texto seleccionado, con el color de al lado.',
    'btn-read-mode': 'Activa la Vista de Lectura: oculta la edición para ver el documento limpio.',
    'btn-image': 'Inserta una imagen desde un archivo o una URL.',
    'btn-table': 'Inserta una tabla, eligiendo cuántas filas y columnas tendrá.',
    'page-margin-y': 'Ajusta el margen superior e inferior de la página, en píxeles.',
    'page-margin-x': 'Ajusta el margen lateral de la página, en píxeles.',
    'btn-add-page': 'Añade una página nueva al documento.',
    'btn-delete-page': 'Borra la página actual del documento.',
    'btn-add-row': 'Añade una fila debajo de la celda seleccionada, dentro de la tabla.',
    'btn-add-col': 'Añade una columna a la derecha de la celda seleccionada.',
    'btn-del-row': 'Elimina la fila de la celda seleccionada.',
    'btn-del-col': 'Elimina la columna de la celda seleccionada.',
    'btn-del-table': 'Elimina la tabla completa.',
    'btn-config-table': 'Configura el grosor del borde y los colores de fondo/línea de la tabla.',
    'grid-font-family': 'Selecciona la fuente de la hoja de cálculo (modo Grid).',
    'btn-grid-add-row': 'Añade una fila a la hoja de cálculo.',
    'btn-grid-add-col': 'Añade una columna a la hoja de cálculo.',
    'btn-grid-del-row': 'Elimina la fila seleccionada de la hoja de cálculo.',
    'btn-grid-del-col': 'Elimina la columna seleccionada de la hoja de cálculo.',
    'btn-grid-import-csv': 'Importa datos desde un archivo CSV o TSV a la hoja de cálculo.',
    'btn-grid-export-csv': 'Exporta la hoja de cálculo actual como archivo CSV.',
    'btn-help': 'Vuelve a abrir el tutorial de bienvenida.',
};

let active = false;
let boxEl = null;
let currentId = null;

function ensureBox() {
    if (boxEl) return boxEl;
    boxEl = document.createElement('div');
    boxEl.id = 'info-tooltip-box';
    boxEl.className = 'info-tooltip-box hidden';
    document.body.appendChild(boxEl);
    return boxEl;
}

function showFor(id, x, y) {
    const text = INFO_MAP[id];
    if (!text) { hide(); return; }
    currentId = id;
    const box = ensureBox();
    box.textContent = text;
    box.classList.remove('hidden');
    position(x, y);
}

function position(x, y) {
    if (!boxEl) return;
    const pad = 14;
    const rect = boxEl.getBoundingClientRect();
    let left = x + pad;
    let top = y + pad;
    if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
    boxEl.style.left = `${Math.max(4, left)}px`;
    boxEl.style.top = `${Math.max(4, top)}px`;
}

function hide() {
    currentId = null;
    if (boxEl) boxEl.classList.add('hidden');
}

function onMouseOver(e) {
    if (!active) return;
    const target = e.target.closest('[id]');
    if (!target || !INFO_MAP[target.id]) { hide(); return; }
    if (target.id !== currentId) showFor(target.id, e.clientX, e.clientY);
}

function onMouseMove(e) {
    if (!active || !currentId) return;
    position(e.clientX, e.clientY);
}

function onMouseOut(e) {
    if (!active) return;
    const related = e.relatedTarget;
    const target = e.target.closest('[id]');
    if (target && related && target.contains(related)) return;
    hide();
}

function setActive(on, toggleBtn) {
    active = on;
    localStorage.setItem(LS_KEYS.INFO_MODE, on ? 'true' : 'false');
    toggleBtn.classList.toggle('active', on);
    toggleBtn.setAttribute('aria-pressed', String(on));
    if (!on) hide();
}

export function initInfoTooltip() {
    const toggleBtn = document.getElementById('btn-info-toggle');
    if (!toggleBtn) return;

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseout', onMouseOut);

    toggleBtn.addEventListener('click', () => setActive(!active, toggleBtn));

    setActive(localStorage.getItem(LS_KEYS.INFO_MODE) === 'true', toggleBtn);
}
