/* Documenti fiscali locali; nessun upload esterno. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const categories = ['Report exchange','Estratto conto','Staking','Dichiarazione','Ricevuta','Altro'];
const extensions = /\.(pdf|png|jpe?g|webp|csv|xlsx?|docx?|odt|ods|txt|zip)$/i;
const maxFile = 20 * 1048576;
let db, records = [], editing = null, busy = false;
const message = (text, error = false) => { $('docs-status').textContent = text; $('docs-status').classList.toggle('docs-error', error); };
const size = n => n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`;
function transaction(mode, action) {
 return new Promise((resolve,reject) => {
  const tx = db.transaction('documents',mode);
  const request = action(tx.objectStore('documents'));
  tx.oncomplete = () => resolve(request?.result);
  tx.onerror = tx.onabort = () => reject(tx.error || Error('Salvataggio non riuscito.'));
 });
}
async function run(action) {
 if(busy) return;
 busy=true; $('docs-panel').setAttribute('aria-busy','true');
 $('docs-panel').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);
 try { await action(); } catch(e) { message(e.name==='QuotaExceededError' ? 'Spazio del browser esaurito. Esporta i documenti prima di eliminarli.' : e.message,true); }
 finally { busy=false; $('docs-panel').removeAttribute('aria-busy'); $('docs-panel').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=false); }
}
async function hash(blob) {
 const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function download(blob,name) {
 const url=URL.createObjectURL(blob), a=document.createElement('a');
 a.href=url; a.download=name; document.body.append(a); a.click(); a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function reset() {
 editing=null; $('docs-form').reset(); $('docs-year').value=new Date().getFullYear();
 $('docs-files').required=true; $('docs-files').hidden=false;
 $('docs-save').textContent='Archivia documenti'; $('docs-cancel').hidden=true;
}
function validate(r) {
 if(!r || !Number.isInteger(r.year) || r.year<2000 || r.year>2100 || !categories.includes(r.category) || typeof r.name!=='string' || r.name.length>255 || !extensions.test(r.name) || typeof r.notes!=='string' || r.notes.length>1000 || typeof r.created!=='string' || !Number.isFinite(Date.parse(r.created))) throw Error('Documento non valido: controlla formato, anno e categoria.');
}
function render() {
 const query=$('docs-search').value.trim().toLocaleLowerCase('it'), year=$('docs-filter-year').value, category=$('docs-filter-category').value;
 const shown=records.filter(r=>(!year || String(r.year)===year) && (!category || r.category===category) && `${r.name} ${r.notes}`.toLocaleLowerCase('it').includes(query));
 $('docs-summary').textContent=`${records.length} documenti · ${size(records.reduce((n,r)=>n+r.blob.size,0))} · ${shown.length} visualizzati`;
 const list=$('docs-list'); list.replaceChildren();
 if(!shown.length) { const p=document.createElement('p'); p.className='docs-empty'; p.textContent=records.length?'Nessun documento corrisponde ai filtri.':'Il tuo archivio è pronto. Aggiungi il primo documento fiscale.'; list.append(p); }
 shown.sort((a,b)=>b.year-a.year || b.created.localeCompare(a.created)).forEach(r=>{
  const card=document.createElement('article'), info=document.createElement('div'), title=document.createElement('h3'), meta=document.createElement('p'), notes=document.createElement('p'), actions=document.createElement('div');
  card.className='docs-record'; actions.className='docs-actions'; title.textContent=r.name; meta.textContent=`${r.year} · ${r.category} · ${size(r.blob.size)}`; notes.textContent=r.notes; info.append(title,meta,notes);
  const button=(text,fn)=>{const b=document.createElement('button'); b.type='button'; b.textContent=text; b.setAttribute('aria-label',`${text}: ${r.name}`); b.onclick=fn; actions.append(b);};
  button('Scarica',()=>download(r.blob,r.name));
  button('Modifica',()=>{
   editing=r.id; $('docs-year').value=r.year; $('docs-category').value=r.category; $('docs-notes').value=r.notes;
   $('docs-files').required=false; $('docs-files').hidden=true; $('docs-save').textContent='Salva modifiche'; $('docs-cancel').hidden=false;
   $('docs-year').focus(); message(`Modifica anno, categoria e note di ${r.name}`);
  });
  button('Elimina',()=>{
   if(!confirm(`Eliminare dall’archivio “${r.name}”? Il file originale non viene eliminato.`)) return;
   run(async()=>{ await transaction('readwrite',s=>s.delete(r.id)); if(editing===r.id) reset(); await refresh(); message('Documento eliminato dall’archivio.'); });
  });
  card.append(info,actions); list.append(card);
 });
}
async function refresh() {
 records=await transaction('readonly',s=>s.getAll());
 const select=$('docs-filter-year'), previous=select.value;
 select.replaceChildren(new Option('Tutti gli anni',''));
 [...new Set(records.map(r=>r.year))].sort((a,b)=>b-a).forEach(y=>select.add(new Option(y,y)));
 select.value=[...select.options].some(o=>o.value===previous)?previous:''; render();
}
function dataURL(blob) { return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Lettura documento non riuscita.'));reader.readAsDataURL(blob);}); }
async function init() {
 categories.forEach(c=>{$('docs-category').add(new Option(c,c));$('docs-filter-category').add(new Option(c,c));}); reset();
 if(!window.indexedDB || !window.crypto?.subtle) throw Error('Archivio non disponibile: apri l’app tramite HTTPS o un server locale.');
 db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('flowchart-fiscal-documents',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('documents',{keyPath:'id'});
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Impossibile aprire l’archivio nel browser.'));
  req.onblocked=()=>message('Chiudi le altre schede dell’app e riapri questa pagina.',true);
 });
 db.onversionchange=()=>db.close(); await refresh();
 $('docs-form').addEventListener('submit',event=>{
  event.preventDefault(); const files=[...$('docs-files').files], metadata={year:Number($('docs-year').value),category:$('docs-category').value,notes:$('docs-notes').value.trim()};
  run(async()=>{
   if(editing) {
    const old=records.find(r=>r.id===editing); if(!old) throw Error('Documento non più disponibile. Ricarica la pagina.');
    const updated={...old,...metadata};validate(updated);await transaction('readwrite',s=>s.put(updated));message('Informazioni aggiornate.');
   } else {
    if(!files.length) throw Error('Seleziona almeno un documento.');
    if(files.reduce((n,f)=>n+f.size,0)>100*1048576) throw Error('Carica al massimo 100 MB per volta.');
    await refresh(); const additions=new Map(), existing=new Set(records.map(r=>r.id));
    for(const file of files) {
     if(!file.size || file.size>maxFile) throw Error(`${file.name}: massimo 20 MB; il file non può essere vuoto.`);
     const r={...metadata,name:file.name,created:new Date().toISOString(),blob:file};validate(r);r.id=await hash(file);
     if(!existing.has(r.id)) additions.set(r.id,r);
    }
    await transaction('readwrite',s=>{additions.forEach(r=>s.put(r));});
    message(`${additions.size} documenti archiviati; ${files.length-additions.size} duplicati ignorati.`);
   }
   reset();await refresh();
  });
 });
 $('docs-cancel').onclick=()=>{reset();message('Modifica annullata.');};
 ['docs-search','docs-filter-year','docs-filter-category'].forEach(id=>$(id).addEventListener('input',render));
 $('docs-export').onclick=()=>run(async()=>{
  await refresh();if(!records.length) throw Error('Non ci sono documenti da esportare.');
  if(records.reduce((n,r)=>n+r.blob.size,0)>100*1048576) throw Error('Archivio oltre 100 MB: scarica i documenti singolarmente.');
  message('Preparazione dell’archivio completo…');const documents=[];
  for(const {blob,...meta} of records) documents.push({...meta,data:await dataURL(blob)});
  download(new Blob([JSON.stringify({format:'flowchart-documenti-fiscali',version:1,documents})],{type:'application/json'}),`documenti-fiscali-${new Date().toISOString().slice(0,10)}.json`);
  message('Archivio esportato con tutti i documenti, inclusi quelli nascosti dai filtri.');
 });
 $('docs-import').onclick=()=>$('docs-import-file').click();
 $('docs-import-file').onchange=event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  run(async()=>{
   if(file.size>150*1048576) throw Error('Archivio troppo grande (massimo 150 MB).');
   const archive=JSON.parse(await file.text());
   if(!archive || archive.format!=='flowchart-documenti-fiscali' || archive.version!==1 || !Array.isArray(archive.documents) || archive.documents.length>5000) throw Error('Seleziona un archivio di documenti fiscali esportato da questa pagina.');
   message('Verifica dei documenti…');await refresh();const additions=new Map(),existing=new Set(records.map(r=>r.id));
   for(const source of archive.documents) {
    validate(source);
    if(typeof source.data!=='string' || source.data.length>maxFile*1.4 || !/^data:[^,]*;base64,/.test(source.data)) throw Error('Contenuto del documento non valido. Nessun documento importato.');
    const raw=atob(source.data.slice(source.data.indexOf(',')+1));
    if(!raw.length || raw.length>maxFile) throw Error('Dimensione documento non valida.');
    const blob=new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'application/octet-stream'}),id=await hash(blob);
    if(id!==source.id) throw Error('Archivio danneggiato: il contenuto non corrisponde al documento.');
    if(!existing.has(id)) additions.set(id,{id,name:source.name,year:source.year,category:source.category,notes:source.notes,created:source.created,blob});
   }
   await transaction('readwrite',s=>{additions.forEach(r=>s.put(r));});await refresh();
   message(`${additions.size} documenti ripristinati. I documenti già presenti sono stati conservati.`);
  });
 };
 message('Archivio pronto. I documenti restano in questo browser.');
}
init().catch(e=>{message(e.message,true);$('docs-panel').querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);});
})();
