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
    document.getElementById('btn-align-left').addEventListener('click', () => execCmd('justifyLeft'));
    document.getElementById('btn-align-center').addEventListener('click', () => execCmd('justifyCenter'));
    document.getElementById('btn-align-right').addEventListener('click', () => execCmd('justifyRight'));
    document.getElementById('btn-align-justify').addEventListener('click', () => execCmd('justifyFull'));

    // Text Color
    const colorInput = document.getElementById('text-color');
    const colorIndicator = document.querySelector('.color-indicator');
    
    // Init indicator color
    colorIndicator.style.backgroundColor = colorInput.value;

    colorInput.addEventListener('input', (e) => {
        colorIndicator.style.backgroundColor = e.target.value;
        execCmd('foreColor', e.target.value);
    });

    // Font family
    const fontSelect = document.getElementById('font-family');
    fontSelect.addEventListener('change', (e) => {
        execCmd('fontName', e.target.value);
    });

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
