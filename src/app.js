document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const tabsBar = document.getElementById('tabs-bar');

    // Multi-document State Management
    let documents = [];
    let activeTabId = null;

    // Load saved documents
    const savedDocsJSON = localStorage.getItem('pixelDocuments');
    if (savedDocsJSON) {
        try {
            documents = JSON.parse(savedDocsJSON);
        } catch(e) {
            documents = [];
        }
    }

    // Migration from old app version
    const oldSavedContent = localStorage.getItem('pixelWordContent');
    if (oldSavedContent && documents.length === 0) {
        documents = [{ id: Date.now().toString(), title: 'Document 1', content: oldSavedContent }];
        localStorage.removeItem('pixelWordContent');
    }

    // Initialize state
    if (documents.length === 0) {
        documents = [{ id: Date.now().toString(), title: 'Document 1', content: '<p></p>' }];
    }
    
    activeTabId = documents[0].id;

    function saveCurrentTabContent() {
        const currentDoc = documents.find(d => d.id === activeTabId);
        if (currentDoc) {
            currentDoc.content = editor.innerHTML;
        }
    }

    function renderTabs() {
        tabsBar.innerHTML = '';
        documents.forEach(doc => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab ' + (doc.id === activeTabId ? 'active' : '');
            tabEl.dataset.id = doc.id;
            
            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = doc.title;
            
            const closeEl = document.createElement('span');
            closeEl.className = 'tab-close';
            closeEl.textContent = 'x';
            closeEl.title = 'Close Document';

            tabEl.appendChild(titleEl);
            tabEl.appendChild(closeEl);
            tabsBar.appendChild(tabEl);
        });
    }

    function loadActiveTab() {
        const activeDoc = documents.find(d => d.id === activeTabId);
        if (activeDoc) {
             editor.innerHTML = activeDoc.content || '<p></p>';
        }
        renderTabs();
    }

    // Init UI
    loadActiveTab();

    // Tab Bar Events (Delegation)
    tabsBar.addEventListener('click', (e) => {
        const tabEl = e.target.closest('.tab');
        if (!tabEl) return;
        
        const docId = tabEl.dataset.id;

        if (e.target.classList.contains('tab-close')) {
            // Close tab
            e.stopPropagation();
            if (documents.length === 1) {
                // if last tab, clear it rename it
                documents = [{ id: Date.now().toString(), title: 'Document 1', content: '<p></p>' }];
                activeTabId = documents[0].id;
                loadActiveTab();
                return;
            }
            
            documents = documents.filter(d => d.id !== docId);
            if (activeTabId === docId) {
                activeTabId = documents[documents.length - 1].id;
                loadActiveTab();
            } else {
                renderTabs();
            }
        } else {
            // Switch tab
            saveCurrentTabContent();
            activeTabId = docId;
            loadActiveTab();
        }
    });

    // Rename via Double Click
    tabsBar.addEventListener('dblclick', (e) => {
        const tabEl = e.target.closest('.tab');
        if (!tabEl) return;
        const docId = tabEl.dataset.id;
        const doc = documents.find(d => d.id === docId);
        if (doc) {
            const newTitle = prompt('Enter new document title:', doc.title);
            if (newTitle !== null && newTitle.trim() !== '') {
                doc.title = newTitle.trim();
                renderTabs();
            }
        }
    });

    // Editor Auto Save to State Mechanism (input capture)
    editor.addEventListener('input', () => {
        saveCurrentTabContent();
    });

    // Save All Documents to localStorage
    document.getElementById('btn-save').addEventListener('click', () => {
        saveCurrentTabContent(); // Ensure latest changes are synced
        localStorage.setItem('pixelDocuments', JSON.stringify(documents));
        
        // Quick visual feedback
        const btnSave = document.getElementById('btn-save');
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = `<svg class="pixel-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 10l-2-2-1 1 3 3 6-6-1-1-5 5z"/>
        </svg> Saved`;
        setTimeout(() => {
            btnSave.innerHTML = originalText;
        }, 1500);
    });

    // New Document
    document.getElementById('btn-new').addEventListener('click', () => {
        saveCurrentTabContent();
        const newId = Date.now().toString();
        documents.push({
            id: newId,
            title: `Document ${documents.length + 1}`,
            content: '<p></p>'
        });
        activeTabId = newId;
        loadActiveTab();
    });

    // Toolbar formatting
    const execCmd = (cmd, value = null) => {
        document.execCommand(cmd, false, value);
        editor.focus();
    };

    document.getElementById('btn-bold').addEventListener('click', () => execCmd('bold'));
    document.getElementById('btn-italic').addEventListener('click', () => execCmd('italic'));
    document.getElementById('btn-highlight').addEventListener('click', () => execCmd('hiliteColor', 'yellow'));
    document.getElementById('btn-align-left').addEventListener('click', () => execCmd('justifyLeft'));
    document.getElementById('btn-align-center').addEventListener('click', () => execCmd('justifyCenter'));
    document.getElementById('btn-align-right').addEventListener('click', () => execCmd('justifyRight'));
    document.getElementById('btn-align-justify').addEventListener('click', () => execCmd('justifyFull'));

    // Page Mode Logic
    const PAGE_HEIGHT = 1056; // 11 inches at 96dpi
    const PAGE_GAP = 20;      // gap between pages

    const btnPageMode = document.getElementById('btn-page-mode');
    const editorContainer = document.getElementById('editor-container');
    const marginControls = document.getElementById('margin-controls');
    const marginYInput = document.getElementById('page-margin-y');
    const marginXInput = document.getElementById('page-margin-x');
    
    let isPagedMode = localStorage.getItem('pixelPageMode') === 'true';
    let savedMarginY = localStorage.getItem('pixelPageMarginY') || '40';
    let savedMarginX = localStorage.getItem('pixelPageMarginX') || '40';
    
    if (isPagedMode) {
        editorContainer.classList.add('paged-mode');
        marginControls.style.display = 'flex';
    }
    
    editor.style.setProperty('--page-margin-y', savedMarginY + 'px');
    editor.style.setProperty('--page-margin-x', savedMarginX + 'px');
    marginYInput.value = savedMarginY;
    marginXInput.value = savedMarginX;

    // Repagination engine: scans block children and pushes any element
    // that overlaps a page-break gap down to the start of the next page.
    function repaginate() {
        if (!isPagedMode) return;
        const marginY = parseInt(marginYInput.value) || 40;
        // Each "virtual page" in the flat canvas is PAGE_HEIGHT px tall,
        // followed by PAGE_GAP px of transparent gap.
        const stride = PAGE_HEIGHT + PAGE_GAP;

        // Work top-to-bottom; remove old repagination margins first so
        // we start from a clean layout, then re-measure.
        clearRepagination();

        const blocks = Array.from(editor.children);
        for (const block of blocks) {
            // offsetTop is relative to the editor (padding already included by CSS).
            const top = block.offsetTop;
            const bottom = top + block.offsetHeight;

            // Which page are we on? (0-based)
            const pageIndex = Math.floor(top / stride);
            // Where within this page does the block start?
            const posInPage = top - pageIndex * stride;
            // Where does this page's visible area end?
            const pageEnd = PAGE_HEIGHT; // visible content zone per stride

            if (posInPage < pageEnd && bottom > pageIndex * stride + pageEnd) {
                // The block crosses the page boundary. Push it to the next page:
                // Required extra top margin = (pageEnd - posInPage) + PAGE_GAP
                const push = (pageEnd - posInPage) + PAGE_GAP;
                block.dataset.repaginationMargin = push;
                block.style.marginTop = (parseInt(block.style.marginTop) || 0) + push + 'px';
            }
        }
    }

    function clearRepagination() {
        for (const block of editor.children) {
            if (block.dataset.repaginationMargin) {
                const prev = parseInt(block.style.marginTop) || 0;
                const added = parseInt(block.dataset.repaginationMargin) || 0;
                const newMargin = prev - added;
                block.style.marginTop = newMargin > 0 ? newMargin + 'px' : '';
                delete block.dataset.repaginationMargin;
            }
        }
    }

    // Run on every keystroke (debounced so it's not too expensive)
    let repaginateTimer = null;
    editor.addEventListener('input', () => {
        if (!isPagedMode) return;
        clearTimeout(repaginateTimer);
        repaginateTimer = setTimeout(repaginate, 150);
    });

    if (isPagedMode) repaginate();
    
    btnPageMode.addEventListener('click', () => {
        isPagedMode = !isPagedMode;
        editorContainer.classList.toggle('paged-mode', isPagedMode);
        marginControls.style.display = isPagedMode ? 'flex' : 'none';
        localStorage.setItem('pixelPageMode', isPagedMode);
        if (!isPagedMode) clearRepagination();
        else repaginate();
    });

    marginYInput.addEventListener('change', (e) => {
        const val = e.target.value;
        editor.style.setProperty('--page-margin-y', val + 'px');
        localStorage.setItem('pixelPageMarginY', val);
        repaginate();
    });
    
    marginXInput.addEventListener('change', (e) => {
        const val = e.target.value;
        editor.style.setProperty('--page-margin-x', val + 'px');
        localStorage.setItem('pixelPageMarginX', val);
    });

    // Universal Color Modal Logic
    const colorPickerModal = document.getElementById('color-picker-modal');
    const colorPickerTitle = document.getElementById('color-picker-title');
    const customHexInput = document.getElementById('custom-hex-input');
    const nativeColorPicker = document.getElementById('native-color-picker');
    const retroPaletteGrid = document.querySelector('.retro-palette-grid');
    const btnCancelColor = document.getElementById('btn-cancel-color');
    const btnConfirmColor = document.getElementById('btn-confirm-color');

    const colorsGridPresets = [ 
        '#F0F0F0', '#000000', '#FF2B2B', '#FFB000', '#FFE66D', 
        '#4ECDC4', '#2980B9', '#4D96FF', '#B1B2FF', '#9B59B6',
        '#F368E0', '#FF9F43', '#10AC84', '#01A3A4', '#5F27CD',
        '#54A0FF', '#00E640', '#F1C40F', '#E74C3C', '#2C3E50'
    ];

    let globalColorCallback = null;
    let globalColorCancelCallback = null;

    function openCustomColorPicker(initialColor, title, callback, cancelCallback = null) {
        colorPickerTitle.textContent = title;
        customHexInput.value = initialColor || '#FFFFFF';
        nativeColorPicker.value = initialColor || '#FFFFFF';
        globalColorCallback = callback;
        globalColorCancelCallback = cancelCallback;
        
        retroPaletteGrid.innerHTML = '';
        colorsGridPresets.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'grid-swatch';
            btn.style.backgroundColor = color;
            btn.onclick = () => { 
                customHexInput.value = color; 
                nativeColorPicker.value = color;
            };
            retroPaletteGrid.appendChild(btn);
        });
        
        colorPickerModal.classList.remove('hidden');
        customHexInput.focus();
    }

    nativeColorPicker.addEventListener('input', (e) => {
        customHexInput.value = e.target.value.toUpperCase();
    });

    customHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            nativeColorPicker.value = val;
        }
    });

    btnCancelColor.onclick = () => {
        colorPickerModal.classList.add('hidden');
        if (globalColorCancelCallback) globalColorCancelCallback();
    };

    btnConfirmColor.onclick = () => {
        let val = customHexInput.value.trim().toUpperCase();
        if (/^[0-9A-F]{3,6}$/i.test(val)) val = '#' + val; 
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            if (globalColorCallback) globalColorCallback(val);
            colorPickerModal.classList.add('hidden');
        } else {
            alert("Código no válido. Usa formato Hex (#RRGGBB).");
        }
    };

    // Text Color & Palette
    const colorTargetWrapper = document.querySelector('[data-target="text-color"]');
    const colorInput = document.getElementById('text-color');
    const colorIndicator = document.getElementById('text-color-indicator');
    const swatches = document.querySelectorAll('.swatch');
    
    // Load saved palette
    const defaultPalette = ['#F0F0F0', '#FF6B6B', '#4ECDC4', '#FFE66D', '#6BCB77', '#4D96FF', '#B1B2FF'];
    let currentPalette = JSON.parse(localStorage.getItem('pixelPalette')) || defaultPalette;

    // Init indicator color
    colorIndicator.style.backgroundColor = colorInput.value;

    function applyColor(color) {
        colorInput.value = color;
        colorIndicator.style.backgroundColor = color;
        execCmd('foreColor', color);
    }

    colorTargetWrapper.addEventListener('click', () => {
        openCustomColorPicker(colorInput.value, "Color de Texto", applyColor);
    });

    swatches.forEach((swatch, i) => {
        // Set initial color from palette state
        if (currentPalette[i]) {
            swatch.style.backgroundColor = currentPalette[i];
            swatch.dataset.color = currentPalette[i];
            swatch.setAttribute('data-color', currentPalette[i]);
            // update title to give hint
            swatch.title = "Click Izquierdo: Elegir\nClick Derecho: Editar";
        }

        swatch.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            applyColor(color);
        });

        // Edit color on right click
        swatch.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const current = swatch.getAttribute('data-color');
            openCustomColorPicker(current, "Editar Paleta", (hex) => {
                swatch.style.backgroundColor = hex;
                swatch.dataset.color = hex;
                swatch.setAttribute('data-color', hex);
                currentPalette[i] = hex;
                localStorage.setItem('pixelPalette', JSON.stringify(currentPalette));
                applyColor(hex);
            });
        });
    });

    // Glow Effect Logic
    const btnGlowToggle = document.getElementById('btn-glow-toggle');
    const glowColorInput = document.getElementById('glow-color-input');
    const glowColorIndicator = document.getElementById('glow-color-indicator');

    let savedGlowColor = localStorage.getItem('pixelGlowColor') || '#ffffff';
    glowColorInput.value = savedGlowColor;
    glowColorIndicator.style.backgroundColor = savedGlowColor;

    btnGlowToggle.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
           editor.focus();
           return;
        }
        
        try {
            const frag = range.extractContents();
            const wrapper = document.createElement('span');
            wrapper.className = 'neon-glow';
            wrapper.style.setProperty('--glow-color', glowColorInput.value);
            
            wrapper.appendChild(frag);
            range.insertNode(wrapper);
            
            selection.removeAllRanges();
            editor.focus();
            
            saveCurrentTabContent();
        } catch (e) {
            console.error(e);
            alert("No se pudo aplicar el brillo. Intenta evitar cruzar saltos de línea largos.");
            editor.focus();
        }
    });

    const glowTargetWrapper = document.querySelector('[data-target="glow-color-input"]');
    glowTargetWrapper.addEventListener('click', () => {
        openCustomColorPicker(glowColorInput.value, "Color del Brillo", (color) => {
            glowColorInput.value = color;
            glowColorIndicator.style.backgroundColor = color;
            localStorage.setItem('pixelGlowColor', color);
        });
    });

    // Chroma Morph Anim Logic
    const animColor1 = document.getElementById('anim-color-1');
    const ind1 = animColor1.nextElementSibling;
    const animColor2 = document.getElementById('anim-color-2');
    const ind2 = animColor2.nextElementSibling;
    const animSpeed = document.getElementById('anim-speed');
    const btnApplyAnim = document.getElementById('btn-apply-anim');

    ind1.style.backgroundColor = animColor1.value;
    ind2.style.backgroundColor = animColor2.value;

    const animTarget1 = document.querySelector('[data-target="anim-color-1"]');
    const animTarget2 = document.querySelector('[data-target="anim-color-2"]');

    animTarget1.addEventListener('click', () => {
        openCustomColorPicker(animColor1.value, "Chroma 1", (c) => {
            animColor1.value = c;
            ind1.style.backgroundColor = c;
        });
    });
    
    animTarget2.addEventListener('click', () => {
        openCustomColorPicker(animColor2.value, "Chroma 2", (c) => {
            animColor2.value = c;
            ind2.style.backgroundColor = c;
        });
    });

    btnApplyAnim.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
           editor.focus();
           return;
        }
        
        try {
            const frag = range.extractContents();
            const wrapper = document.createElement('span');
            wrapper.className = 'animated-color';
            wrapper.style.setProperty('--color1', animColor1.value);
            wrapper.style.setProperty('--color2', animColor2.value);
            wrapper.style.setProperty('--anim-duration', animSpeed.value + 's');
            
            wrapper.appendChild(frag);
            range.insertNode(wrapper);
            
            selection.removeAllRanges();
            editor.focus();
            
            saveCurrentTabContent();
        } catch (e) {
            console.error(e);
            alert("No se pudo aplicar animación. Intenta evitar cruzar saltos de línea largos.");
            editor.focus();
        }
    });

    // Font family & Size
    const fontSelect = document.getElementById('font-family');
    fontSelect.addEventListener('change', (e) => {
        execCmd('fontName', e.target.value);
    });

    const fontSizeSelect = document.getElementById('font-size');
    if(fontSizeSelect) {
        fontSizeSelect.addEventListener('change', (e) => {
            execCmd('fontSize', e.target.value);
        });
    }

    // Table Modal
    const modal = document.getElementById('table-modal');
    const btnTable = document.getElementById('btn-table');
    const btnCancelTable = document.getElementById('btn-cancel-table');
    const btnConfirmTable = document.getElementById('btn-confirm-table');

    btnTable.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    btnCancelTable.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    btnConfirmTable.addEventListener('click', () => {
        const rows = parseInt(document.getElementById('table-rows').value, 10);
        const cols = parseInt(document.getElementById('table-cols').value, 10);
        
        let tableHTML = '<table>';
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>';
            for (let j = 0; j < cols; j++) {
                if (i === 0) {
                    tableHTML += '<th>Header</th>';
                } else {
                    tableHTML += '<td>Data</td>';
                }
            }
            tableHTML += '</tr>';
        }
        tableHTML += '</table><p><br></p>'; // Add trailing paragraph so cursor can jump past table

        editor.focus();
        execCmd('insertHTML', tableHTML);
        modal.classList.add('hidden');
    });

    // Table Context Tools
    const tableTools = document.getElementById('table-tools');
    const tableDragHandle = document.getElementById('table-drag-handle');
    const btnAddRow = document.getElementById('btn-add-row');
    const btnAddCol = document.getElementById('btn-add-col');
    const btnDelRow = document.getElementById('btn-del-row');
    const btnDelCol = document.getElementById('btn-del-col');

    let activeTable = null;
    let activeRow = null;
    let activeCell = null;

    let isDraggingTable = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let tableInitialMarginX = 0;
    let tableInitialMarginY = 0;
    let selectedTableNode = null;

    function updateHandlePosition() {
        if (!activeTable) return;
        const container = document.getElementById('editor-container');
        const containerRect = container.getBoundingClientRect();
        const tableRect = activeTable.getBoundingClientRect();

        const top = tableRect.top - containerRect.top + container.scrollTop - 24;
        const left = tableRect.left - containerRect.left + container.scrollLeft - 24;
        
        tableDragHandle.style.top = top + 'px';
        tableDragHandle.style.left = left + 'px';
        tableDragHandle.style.display = 'flex';
    }

    function checkTableContext() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        let node = selection.anchorNode;
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        
        if (!editor.contains(node)) {
            tableTools.style.display = 'none';
            tableDragHandle.style.display = 'none';
            activeTable = null;
            return;
        }

        const cell = node.closest ? node.closest('td, th') : null;
        if (cell && editor.contains(cell)) {
            activeCell = cell;
            activeRow = cell.closest('tr');
            activeTable = cell.closest('table');
            tableTools.style.display = 'flex';
            updateHandlePosition();
        } else {
            tableTools.style.display = 'none';
            tableDragHandle.style.display = 'none';
            activeTable = null;
        }
    }

    tableDragHandle.addEventListener('mousedown', (e) => {
        if (!activeTable) return;
        isDraggingTable = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // Convert to absolute positioning to allow overlapping text
        if (activeTable.style.position !== 'absolute') {
            const tableRect = activeTable.getBoundingClientRect();
            const parentRect = editor.getBoundingClientRect();
            activeTable.style.position = 'absolute';
            activeTable.style.left = (tableRect.left - parentRect.left) + 'px';
            activeTable.style.top = (tableRect.top - parentRect.top) + 'px';
            activeTable.style.margin = '0'; 
        }

        tableInitialMarginX = parseFloat(activeTable.style.left) || 0;
        tableInitialMarginY = parseFloat(activeTable.style.top) || 0;
        e.preventDefault();

        if (selectedTableNode && selectedTableNode !== activeTable) {
            selectedTableNode.classList.remove('selected-for-deletion');
        }
        selectedTableNode = activeTable;
        selectedTableNode.classList.add('selected-for-deletion');
    });

    let resizingCell = null;
    let resizingStartX = 0;
    let resizingStartWidth = 0;

    editor.addEventListener('mousemove', (e) => {
        if (isDraggingTable) return;
        if (resizingCell) {
            let targetWidth = resizingStartWidth + (e.clientX - resizingStartX);
            resizingCell.style.width = targetWidth + 'px';
            e.preventDefault();
            return;
        }

        const cell = e.target.closest('th, td');
        if (cell && activeTable === cell.closest('table')) {
            const rect = cell.getBoundingClientRect();
            if (e.clientX > rect.right - 8 && e.clientX <= rect.right) {
                editor.style.cursor = 'col-resize';
                cell.dataset.resizable = 'true';
            } else {
                editor.style.cursor = 'text';
                cell.dataset.resizable = 'false';
            }
        } else {
            editor.style.cursor = 'text';
        }
    });

    editor.addEventListener('mousedown', (e) => {
        const cell = e.target.closest('th, td');
        if (cell && cell.dataset.resizable === 'true' && editor.style.cursor === 'col-resize') {
            resizingCell = cell;
            resizingStartX = e.clientX;
            
            // Fix layout so width applies natively per column
            const table = cell.closest('table');
            if (table.style.tableLayout !== 'fixed') {
                 const firstRow = table.rows[0];
                 for (let c of firstRow.cells) {
                     c.style.width = c.getBoundingClientRect().width + 'px';
                 }
                 table.style.tableLayout = 'fixed';
                 table.style.width = table.getBoundingClientRect().width + 'px';
            }
            resizingStartWidth = parseFloat(getComputedStyle(cell).width);
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingTable || !activeTable) return;
        
        let dx = e.clientX - dragStartX;
        let dy = e.clientY - dragStartY;
        
        let targetX = tableInitialMarginX + dx;
        let targetY = tableInitialMarginY + dy;

        if (e.ctrlKey) {
            targetX = Math.round(targetX / 16) * 16;
            targetY = Math.round(targetY / 16) * 16;
        }

        activeTable.style.left = targetX + 'px';
        activeTable.style.top = targetY + 'px';
        updateHandlePosition();
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingTable) {
            isDraggingTable = false;
            saveCurrentTabContent();
        }
        if (resizingCell) {
            resizingCell = null;
            editor.style.cursor = 'text';
            saveCurrentTabContent();
        }
    });

    document.addEventListener('click', (e) => {
        if (selectedTableNode && !tableDragHandle.contains(e.target)) {
            selectedTableNode.classList.remove('selected-for-deletion');
            selectedTableNode = null;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (selectedTableNode && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            selectedTableNode.remove();
            selectedTableNode = null;
            tableDragHandle.style.display = 'none';
            tableTools.style.display = 'none';
            activeTable = null;
            saveCurrentTabContent();
        }
    });

    document.getElementById('editor-container').addEventListener('scroll', updateHandlePosition);

    // Attach to events that could change selection
    editor.addEventListener('keyup', checkTableContext);
    editor.addEventListener('mouseup', checkTableContext);
    editor.addEventListener('click', checkTableContext);
    let typeSaveTimeout = null;
    editor.addEventListener('input', (e) => {
        checkTableContext();
        if (typeSaveTimeout) clearTimeout(typeSaveTimeout);
        typeSaveTimeout = setTimeout(() => {
            saveCurrentTabContent();
        }, 500);
    });

    // Filter pasted content to pure text
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    btnAddRow.addEventListener('click', () => {
        if (!activeTable || !activeRow) return;
        const newRow = activeTable.insertRow(activeRow.rowIndex + 1);
        for (let i = 0; i < activeRow.cells.length; i++) {
            const tagName = activeRow.cells[i].tagName.toLowerCase();
            const newCell = document.createElement(tagName);
            newCell.textContent = 'Data';
            newRow.appendChild(newCell);
        }
        saveCurrentTabContent();
    });

    btnAddCol.addEventListener('click', () => {
        if (!activeTable || !activeCell) return;
        const colIndex = activeCell.cellIndex;
        for (let i = 0; i < activeTable.rows.length; i++) {
            const row = activeTable.rows[i];
            const isHeader = row.cells.length && row.cells[0].tagName.toLowerCase() === 'th';
            const newTag = isHeader ? 'th' : 'td';
            const cell = document.createElement(newTag);
            cell.textContent = isHeader ? 'Header' : 'Data';
            
            // Handle columns correctly when rows might have fewer cells
            if (colIndex + 1 < row.cells.length) {
                row.insertBefore(cell, row.cells[colIndex + 1]);
            } else {
                row.appendChild(cell);
            }
        }
        saveCurrentTabContent();
    });

    btnDelRow.addEventListener('click', () => {
        if (!activeTable || !activeRow) return;
        activeTable.deleteRow(activeRow.rowIndex);
        if (activeTable.rows.length === 0) activeTable.remove();
        checkTableContext();
        saveCurrentTabContent();
    });

    btnDelCol.addEventListener('click', () => {
        if (!activeTable || !activeCell) return;
        const colIndex = activeCell.cellIndex;
        for (let i = 0; i < activeTable.rows.length; i++) {
            if (activeTable.rows[i].cells[colIndex]) {
                activeTable.rows[i].deleteCell(colIndex);
            }
        }
        if (activeTable.rows.length > 0 && activeTable.rows[0].cells.length === 0) activeTable.remove();
        checkTableContext();
        saveCurrentTabContent();
    });

    // Table Style Config Logic
    const tableStyleModal = document.getElementById('table-style-modal');
    const btnConfigTable = document.getElementById('btn-config-table');
    const btnCancelStyle = document.getElementById('btn-cancel-style');
    const btnConfirmStyle = document.getElementById('btn-confirm-style');
    const styleBorderWidth = document.getElementById('style-border-width');
    const styleBorderColor = document.getElementById('style-border-color');
    const styleBgColor = document.getElementById('style-bg-color');

    btnConfigTable.addEventListener('click', () => {
        if (!activeTable) return;
        tableStyleModal.classList.remove('hidden');
        
        const cell = activeTable.rows[0]?.cells[0];
        if (cell) {
             const bw = parseInt(getComputedStyle(cell).borderWidth);
             styleBorderWidth.value = isNaN(bw) ? 2 : bw;
        }
    });

    const styleBorderTarget = document.querySelector('[data-target="style-border-color"]');
    const styleBorderIndicator = document.getElementById('style-border-indicator');
    styleBorderTarget.addEventListener('click', () => {
        tableStyleModal.classList.add('hidden'); // Hide temporarily
        openCustomColorPicker(styleBorderColor.value, "Color Borde Tabla", (color) => {
            styleBorderColor.value = color;
            styleBorderIndicator.style.backgroundColor = color;
            tableStyleModal.classList.remove('hidden'); // Show back
        }, () => { tableStyleModal.classList.remove('hidden'); });
    });

    const styleBgTarget = document.querySelector('[data-target="style-bg-color"]');
    const styleBgIndicator = document.getElementById('style-bg-indicator');
    styleBgTarget.addEventListener('click', () => {
        tableStyleModal.classList.add('hidden'); // Hide temporarily
        openCustomColorPicker(styleBgColor.value, "Color Fondo Tabla", (color) => {
            styleBgColor.value = color;
            styleBgIndicator.style.backgroundColor = color;
            tableStyleModal.classList.remove('hidden'); // Show back
        }, () => { tableStyleModal.classList.remove('hidden'); });
    });

    btnCancelStyle.addEventListener('click', () => tableStyleModal.classList.add('hidden'));

    btnConfirmStyle.addEventListener('click', () => {
        if (activeTable) {
            const bw = styleBorderWidth.value + 'px';
            const bc = styleBorderColor.value;
            const bg = styleBgColor.value;

            activeTable.style.backgroundColor = bg !== 'transparent' ? bg : '';
            
            for (let r of activeTable.rows) {
                for (let c of r.cells) {
                    if (bc) c.style.borderColor = bc;
                    c.style.borderWidth = bw;
                    c.style.borderStyle = styleBorderWidth.value == '0' ? 'none' : 'solid';
                }
            }
            saveCurrentTabContent();
        }
        tableStyleModal.classList.add('hidden');
    });

    // Image Upload Logic
    const btnImage = document.getElementById('btn-image');
    const imageUpload = document.getElementById('image-upload');

    btnImage.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                // Ensure the selection is inside the editor, inserting inline or block
                editor.focus();
                const imgHTML = `<img src="${event.target.result}" style="max-width: 100%; image-rendering: pixelated; margin: 10px 0; border: 2px solid var(--border-color); display: block;" alt="[Imagen]"/><p><br></p>`;
                execCmd('insertHTML', imgHTML);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // reset so same file can be chosen again
    });

    // Save as PXP
    document.getElementById('btn-save-pxp').addEventListener('click', async () => {
        saveCurrentTabContent();
        const currentDoc = documents.find(d => d.id === activeTabId);
        if (!currentDoc) return;
        
        const pxpData = JSON.stringify({
            title: currentDoc.title,
            content: currentDoc.content
        });

        if (window.__TAURI__) {
            try {
                const { save } = window.__TAURI__.dialog;
                const { writeTextFile } = window.__TAURI__.fs;
                
                const filePath = await save({
                    filters: [{ name: 'Pixel Processor Document', extensions: ['pxp'] }],
                    defaultPath: currentDoc.title + '.pxp'
                });

                if (filePath) {
                    await writeTextFile(filePath, pxpData);
                }
            } catch (err) {
                console.error("No se pudo guardar PXP", err);
                alert("Error al guardar .PXP en entorno nativo.");
            }
        } else {
            const blob = new Blob([pxpData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentDoc.title + '.pxp';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    // Open PXP File
    const pxpUpload = document.getElementById('pxp-upload');
    
    document.getElementById('btn-open-file').addEventListener('click', async () => {
        if (window.__TAURI__) {
            try {
                const { open } = window.__TAURI__.dialog;
                const { readTextFile } = window.__TAURI__.fs;
                
                const filePath = await open({
                    multiple: false,
                    filters: [{ name: 'Pixel Processor Document', extensions: ['pxp'] }]
                });

                if (filePath) {
                    const content = await readTextFile(filePath);
                    loadPxpData(content);
                }
            } catch (err) {
                console.error("No se pudo abrir PXP", err);
                alert("Error al abrir .PXP en entorno nativo.");
            }
        } else {
            pxpUpload.click();
        }
    });

    pxpUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                loadPxpData(event.target.result);
            };
            reader.readAsText(file);
        }
        e.target.value = '';
    });

    function loadPxpData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data && data.title && typeof data.content !== 'undefined') {
                saveCurrentTabContent(); // save current before switching
                const newId = Date.now().toString();
                documents.push({
                    id: newId,
                    title: data.title,
                    content: data.content
                });
                activeTabId = newId;
                loadActiveTab();
            } else {
                alert("El archivo .pxp no tiene el formato correcto.");
            }
        } catch(e) {
            console.error("Error parsing PXP", e);
            alert("Error al leer el archivo .pxp.");
        }
    }

    // Export to TXT
    document.getElementById('btn-export').addEventListener('click', async () => {
        const textContent = domToASCII(editor);
        
        // Use Tauri Native Dialog if running in desktop environment
        if (window.__TAURI__) {
            try {
                // Using Tauri v2 API
                const { save } = window.__TAURI__.dialog;
                const { writeTextFile } = window.__TAURI__.fs;
                
                const filePath = await save({
                    filters: [{
                        name: 'Text Document',
                        extensions: ['txt']
                    }],
                    defaultPath: 'pixel_document.txt'
                });

                if (filePath) {
                    await writeTextFile(filePath, textContent);
                }
            } catch (err) {
                console.error("No se pudo guardar usando Tauri", err);
                alert("Error al exportar desde el entorno nativo.");
            }
        } else {
            // Web / Browser Fallback
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixel_document.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    // PDF Export Logic
    document.getElementById('btn-export-pdf').addEventListener('click', async () => {
        if (typeof window.html2canvas === 'undefined') {
            alert('html2canvas no se ha cargado. Comprueba la conexión a internet.');
            return;
        }

        const element = document.getElementById('editor');
        const activeDocTitle = activeTabId
            ? (documents.find(d => d.id === activeTabId)?.title || 'Documento')
            : 'Documento';

        // ── 1. Read computed background color (resolves CSS vars) ──────────────
        const computedBg    = getComputedStyle(element).backgroundColor;
        const computedColor = getComputedStyle(element).color;

        // ── 2. Force explicit inline styles so html2canvas can see them ────────
        const prevInlineBg    = element.style.backgroundColor;
        const prevInlineColor = element.style.color;
        element.style.backgroundColor = computedBg;
        element.style.color           = computedColor;

        // Apply to every descendant too
        const allEls = Array.from(element.querySelectorAll('*'));
        const savedElStyles = allEls.map(el => {
            const cs   = getComputedStyle(el);
            const saved = { el, bg: el.style.backgroundColor, color: el.style.color };
            const bg    = cs.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                el.style.backgroundColor = bg;
            }
            el.style.color = cs.color;
            return saved;
        });

        // ── 3. Remove mask & repagination margins so canvas is a clean flow ────
        const prevMask  = element.style.mask;
        const prevWMask = element.style.webkitMask;
        element.style.mask        = 'none';
        element.style.webkitMask  = 'none';
        if (isPagedMode) clearRepagination();

        // ── 4. Capture the full editor as one high-res canvas ─────────────────
        const SCALE = 2;
        let fullCanvas;
        try {
            fullCanvas = await window.html2canvas(element, {
                scale:           SCALE,
                useCORS:         true,
                backgroundColor: computedBg,
                logging:         false
            });
        } finally {
            // ── 5. Restore everything ──────────────────────────────────────────
            element.style.backgroundColor = prevInlineBg;
            element.style.color           = prevInlineColor;
            element.style.mask            = prevMask;
            element.style.webkitMask      = prevWMask;
            savedElStyles.forEach(({ el, bg, color }) => {
                el.style.backgroundColor = bg;
                el.style.color           = color;
            });
            if (isPagedMode) repaginate();
        }

        // ── 6. Slice canvas into PDF pages ─────────────────────────────────────
        // After clearing repagination & mask the canvas is a clean continuous flow.
        // We slice every PAGE_HEIGHT * SCALE pixels — no gap to skip.
        const PAGE_H_PX = PAGE_HEIGHT * SCALE;   // 1056 * 2 = 2112px per page
        const PDF_W_IN  = 8.5;
        const PDF_H_IN  = 11;

        const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!JsPDF) {
            alert('jsPDF no está disponible.');
            return;
        }

        const pdf = new JsPDF({ unit: 'in', format: [PDF_W_IN, PDF_H_IN], orientation: 'portrait' });
        let canvasY   = 0;
        let pageIndex = 0;

        while (canvasY < fullCanvas.height) {
            if (pageIndex > 0) pdf.addPage([PDF_W_IN, PDF_H_IN], 'portrait');

            const sliceH = Math.min(PAGE_H_PX, fullCanvas.height - canvasY);

            const pageCanvas  = document.createElement('canvas');
            pageCanvas.width  = fullCanvas.width;
            pageCanvas.height = PAGE_H_PX;
            const ctx = pageCanvas.getContext('2d');
            ctx.fillStyle = computedBg;
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(fullCanvas,
                0, canvasY, fullCanvas.width, sliceH,
                0, 0,       pageCanvas.width, sliceH);

            pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, PDF_W_IN, PDF_H_IN);

            if (!isPagedMode) break;   // continuous mode → single-page PDF
            canvasY += PAGE_H_PX;
            pageIndex++;
        }

        pdf.save(`${activeDocTitle}.pdf`);
    });

    // Parser functions to convert editor DOM to ASCII text (handling Tables)
    function domToASCII(node) {
        let text = '';
        for(let child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                let tag = child.tagName.toLowerCase();
                if (tag === 'br') {
                    text += '\n';
                } else if (tag === 'p' || tag === 'div') {
                    text += domToASCII(child) + '\n';
                } else if (tag === 'table') {
                    text += '\n' + tableToASCII(child) + '\n';
                } else if (tag === 'img') {
                    text += '\n[Imagen local]\n';
                } else {
                    text += domToASCII(child);
                }
            }
        }
        // Basic cleanup of multiple empty lines
        return text.replace(/\n{3,}/g, '\n\n').trim();
    }

    function tableToASCII(table) {
        let rows = Array.from(table.rows);
        if (!rows.length) return '';
        
        // Calculate max width per column
        let colWidths = [];
        rows.forEach(row => {
            Array.from(row.cells).forEach((cell, i) => {
                let len = cell.innerText.trim().length;
                colWidths[i] = Math.max(colWidths[i] || 3, len); // min 3 chars
            });
        });

        // Building the table line separators, e.g. +------+------+
        let separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
        
        let ascii = separator + '\n';
        
        rows.forEach((row, rowIndex) => {
            let isHeader = row.cells.length && row.cells[0].tagName.toLowerCase() === 'th';
            let rowStr = '|';
            Array.from(row.cells).forEach((cell, i) => {
                let content = cell.innerText.trim();
                rowStr += ' ' + content.padEnd(colWidths[i], ' ') + ' |';
            });
            
            ascii += rowStr + '\n';
            
            // Add separator after header
            if (isHeader) {
                ascii += separator + '\n';
            }
        });
        
        // Add final separator if the last row was not a header
        if (rows.length > 0 && Array.from(rows[rows.length-1].cells).some(c => c.tagName.toLowerCase() !== 'th')) {
           ascii += separator + '\n';
        }
        
        return ascii;
    }
});
