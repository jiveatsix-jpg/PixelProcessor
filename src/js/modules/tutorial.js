// ── Tutorial de bienvenida ────────────────────────────────────────────────────
// Overlay paso a paso, estilo modal existente (.modal / .pixel-btn). Se dispara
// solo la primera vez y se puede reabrir desde el botón "?" del sidebar.

import { LS_KEYS } from '../config.js';

const STEPS = [
    {
        title: 'PIXEL WORD',
        text: 'Bienvenido a Pixel Word — un procesador de texto pixel-art minimalista. Puedes tener varios documentos a la vez (pestañas arriba del editor) y guardarlos en el navegador o como archivo .PXP.',
    },
    {
        title: 'FORMATO Y COLOR',
        text: 'Negrita, cursiva, resaltado y coloreado de puntuación sobre el texto seleccionado. La paleta de colores incluye tonos fijos, un selector de color personalizado y la posibilidad de guardar tus propias paletas para reutilizarlas.',
    },
    {
        title: 'EFECTOS ESPECIALES',
        text: 'Aplica brillo (glow) o contorno a la selección, o una animación chroma entre dos colores con velocidad ajustable. El botón de libro (📖) activa la Vista de Lectura, sin edición, para ver el documento limpio.',
    },
    {
        title: 'IMÁGENES Y TABLAS',
        text: 'Inserta imágenes desde un archivo o una URL, con ancho y alineación configurables. También puedes insertar tablas y, con la tabla seleccionada, añadir o quitar filas/columnas y ajustar sus estilos.',
    },
    {
        title: 'PÁGINAS Y HOJA DE CÁLCULO',
        text: 'Ajusta los márgenes de página (X/Y) y añade o borra páginas. El botón GRID abre un modo de hoja de cálculo aparte, con sus propias filas/columnas e importación/exportación CSV.',
    },
    {
        title: 'GUARDAR Y EXPORTAR',
        text: 'SAVE guarda en este navegador; SAVE PXP descarga un archivo .pxp para abrir después con OPEN PXP. EXPORT sirve para sacar el documento como .TXT, .PDF o .GIF animado (este último muestra tus efectos de color en movimiento).',
    },
];

let step = 0;
let modalEl, titleEl, textEl, labelEl, dotsEl, prevBtn, nextBtn;

function render() {
    const s = STEPS[step];
    labelEl.textContent = `PASO ${step + 1} DE ${STEPS.length}`;
    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    prevBtn.disabled = step === 0;
    nextBtn.textContent = step === STEPS.length - 1 ? 'ENTENDIDO' : 'SIGUIENTE';
    dotsEl.innerHTML = STEPS.map((_, i) =>
        `<span class="tutorial-dot${i === step ? ' active' : ''}"></span>`
    ).join('');
}

function open() {
    step = 0;
    render();
    modalEl.classList.remove('hidden');
}

function close() {
    modalEl.classList.add('hidden');
    localStorage.setItem(LS_KEYS.TUTORIAL_SEEN, 'true');
}

export function initTutorial() {
    modalEl = document.getElementById('tutorial-modal');
    titleEl = document.getElementById('tutorial-title');
    textEl = document.getElementById('tutorial-text');
    labelEl = document.getElementById('tutorial-step-label');
    dotsEl = document.getElementById('tutorial-dots');
    prevBtn = document.getElementById('btn-tutorial-prev');
    nextBtn = document.getElementById('btn-tutorial-next');
    const helpBtn = document.getElementById('btn-help');
    const closeBtn = document.getElementById('btn-tutorial-close');

    helpBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });
    prevBtn.addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
    nextBtn.addEventListener('click', () => {
        if (step === STEPS.length - 1) { close(); return; }
        step = Math.min(STEPS.length - 1, step + 1);
        render();
    });

    if (!localStorage.getItem(LS_KEYS.TUTORIAL_SEEN)) open();
}
