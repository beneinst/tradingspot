  // Array per memorizzare le regole
        let rules = [];
        
        // Carica le regole salvate al caricamento della pagina
        document.addEventListener('DOMContentLoaded', () => {
            loadRules();
            renderRules();
        });
        
        // Gestione anteprima immagine
        document.getElementById('rule-image').addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('image-preview');
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        });
        
        // Gestione del form di invio delle regole
        document.getElementById('rule-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('rule-title');
            const contentInput = document.getElementById('rule-content');
            const imageInput = document.getElementById('rule-image');
            const preview = document.getElementById('image-preview');
            
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            
            if (title && content) {
                let imageData = null;
                if (imageInput.files[0]) {
                    imageData = preview.src; // Base64 dell'immagine
                }
                
                addRule(title, content, imageData);
                
                // Reset form
                titleInput.value = '';
                contentInput.value = '';
                imageInput.value = '';
                preview.style.display = 'none';
            }
        });
        
        // Funzione per aggiungere una nuova regola
        function addRule(title, content, imageData = null) {
            const rule = {
                id: Date.now(),
                title: title,
                content: content,
                image: imageData,
                createdAt: new Date().toISOString()
            };
            
            // Aggiungi la regola all'inizio dell'array
            rules.unshift(rule);
            
            // Salva e aggiorna la visualizzazione
            saveRules();
            renderRules();
        }
        
        // Funzione per eliminare una regola
        function deleteRule(id) {
            if (confirm('Sei sicuro di voler eliminare questa regola?')) {
                rules = rules.filter(rule => rule.id !== id);
                saveRules();
                renderRules();
            }
        }
        
        // Funzione per salvare le regole nel localStorage
        function saveRules() {
            try {
                localStorage.setItem('tradingRules', JSON.stringify(rules));
            } catch (e) {
                console.error('Errore nel salvataggio:', e);
                alert('Errore nel salvataggio. Le immagini potrebbero essere troppo grandi.');
            }
        }
        
        // Funzione per caricare le regole dal localStorage
        function loadRules() {
            try {
                const savedRules = localStorage.getItem('tradingRules');
                if (savedRules) {
                    rules = JSON.parse(savedRules);
                }
            } catch (e) {
                console.error('Errore nel caricamento:', e);
                rules = [];
            }
        }
        
        // Funzione per visualizzare le regole
        function renderRules() {
            const rulesContainer = document.getElementById('rules-container');
            rulesContainer.innerHTML = '';
            
            if (rules.length === 0) {
                rulesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Non hai ancora regole. Aggiungi una nuova regola usando il form qui sopra.</p>
                    </div>
                `;
                return;
            }
            
            rules.forEach(rule => {
                const ruleElement = document.createElement('div');
                ruleElement.className = 'rule';
                
                const createdDate = new Date(rule.createdAt).toLocaleString('it-IT');
                
                ruleElement.innerHTML = `
                    <h3>${rule.title}</h3>
                    <div class="rule-date">Creato il: ${createdDate}</div>
                    <div class="rule-content">${rule.content}</div>
                    ${rule.image ? `<img src="${rule.image}" class="rule-image" alt="Immagine regola">` : ''}
                    <div class="rule-actions">
                        <button onclick="deleteRule(${rule.id})" class="btn-danger">Elimina</button>
                    </div>
                `;
                rulesContainer.appendChild(ruleElement);
            });
        }
        
     