        // Array per memorizzare le note
        let notes = [];
        
        // Carica le note salvate al caricamento della pagina
        document.addEventListener('DOMContentLoaded', () => {
            loadNotes();
            renderNotes();
        });
        
        // Gestione del form di invio delle note
        document.getElementById('note-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('note-title');
            const contentInput = document.getElementById('note-content');
            
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            
            if (title && content) {
                addNote(title, content);
                titleInput.value = '';
                contentInput.value = '';
            }
        });
        
        // Funzione per aggiungere una nuova nota
        function addNote(title, content) {
            const note = {
                id: Date.now(), // Usa il timestamp come id univoco
                title: title,
                content: content,
                createdAt: new Date().toISOString()
            };
            
            // Aggiungi la nota all'inizio dell'array (per mostrarle in ordine inverso)
            notes.unshift(note);
            
            // Salva e aggiorna la visualizzazione
            saveNotes();
            renderNotes();
        }
        
        // Funzione per eliminare una nota
        function deleteNote(id) {
            if (confirm('Sei sicuro di voler eliminare questa nota?')) {
                notes = notes.filter(note => note.id !== id);
                saveNotes();
                renderNotes();
            }
        }
        
        // Funzione per iniziare la modifica di una nota
        function editNote(id) {
            const note = notes.find(n => n.id === id);
            if (!note) return;
            
            // Trova l'elemento della nota nel DOM
            const noteElement = document.querySelector(`[data-note-id="${id}"]`);
            if (!noteElement) return;
            
            // Nascondi il contenuto normale e mostra il form di modifica
            const noteContent = noteElement.querySelector('.note-content');
            const noteActions = noteElement.querySelector('.note-actions');
            
            // Crea il form di modifica
            const editForm = document.createElement('div');
            editForm.className = 'edit-form';
            editForm.innerHTML = `
                <input type="text" id="edit-title-${id}" value="${note.title}" placeholder="Titolo della nota">
                <textarea id="edit-content-${id}" placeholder="Contenuto della nota">${note.content}</textarea>
                <div class="btn-group">
                    <button onclick="saveEdit(${id})" class="btn-primary">Salva Modifiche</button>
                    <button onclick="cancelEdit(${id})" class="btn-secondary">Annulla</button>
                </div>
            `;
            
            // Nascondi il contenuto originale e mostra il form
            noteContent.style.display = 'none';
            noteActions.style.display = 'none';
            noteElement.appendChild(editForm);
        }
        
        // Funzione per salvare le modifiche
        function saveEdit(id) {
            const titleInput = document.getElementById(`edit-title-${id}`);
            const contentInput = document.getElementById(`edit-content-${id}`);
            
            const newTitle = titleInput.value.trim();
            const newContent = contentInput.value.trim();
            
            if (newTitle && newContent) {
                // Trova e aggiorna la nota
                const noteIndex = notes.findIndex(n => n.id === id);
                if (noteIndex !== -1) {
                    notes[noteIndex].title = newTitle;
                    notes[noteIndex].content = newContent;
                    notes[noteIndex].updatedAt = new Date().toISOString();
                    
                    saveNotes();
                    renderNotes();
                }
            } else {
                alert('Per favore, inserisci sia il titolo che il contenuto della nota.');
            }
        }
        
        // Funzione per annullare la modifica
        function cancelEdit(id) {
            renderNotes(); // Semplicemente ri-renderizza per rimuovere il form di modifica
        }
        
        // Funzione per salvare le note nel localStorage
        function saveNotes() {
            localStorage.setItem('notes', JSON.stringify(notes));
        }
        
        // Funzione per caricare le note dal localStorage
        function loadNotes() {
            const savedNotes = localStorage.getItem('notes');
            if (savedNotes) {
                notes = JSON.parse(savedNotes);
            }
        }
        
        // Funzione per visualizzare le note
        function renderNotes() {
            const notesContainer = document.getElementById('notes-container');
            notesContainer.innerHTML = '';
            
            if (notes.length === 0) {
                notesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Non hai ancora note. Aggiungi una nuova nota usando il form qui sopra.</p>
                    </div>
                `;
                return;
            }
            
            notes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.setAttribute('data-note-id', note.id);
                
                const updatedText = note.updatedAt ? ` (modificata il ${new Date(note.updatedAt).toLocaleDateString('it-IT')})` : '';
                
                noteElement.innerHTML = `
                    <div class="note-content">
                        <h3>${note.title}</h3>
                        <p>${note.content}</p>
                        <small style="color: #999;">Creata il ${new Date(note.createdAt).toLocaleDateString('it-IT')}${updatedText}</small>
                    </div>
                    <div class="note-actions">
                        <button onclick="editNote(${note.id})" class="btn-edit">Modifica</button>
                        <button onclick="deleteNote(${note.id})" class="btn-danger">Elimina</button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
            });
        }
        
     