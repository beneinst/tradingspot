/* Elementi condivisi, senza dipendenze dai dati del tracker. */
(() => {
 const copyright='⛰️ 2026 © FlowChart by Gerardo D';
 document.querySelectorAll('p').forEach(p=>{
  if(p.textContent.trim()===copyright) {
   const parent=p.parentElement;
   p.remove();
   // Remove only empty, decorative wrappers left by the original footer.
   if(parent!==document.body && !parent.children.length && !parent.textContent.trim()) parent.remove();
  }
 });
 const footer=document.createElement('footer');footer.className='app-footer';
 const text=document.createElement('p');text.textContent=copyright;footer.append(text);document.body.append(footer);
 const menu=document.getElementById('offcanvasMenu'), trigger=document.getElementById('hamburgerBtn');
 if(!menu || !trigger) return;
 const close=document.getElementById('closeMenuBtn');
 trigger.setAttribute('aria-label','Apri menu di navigazione');trigger.setAttribute('aria-controls',menu.id);
 if(close)close.setAttribute('aria-label','Chiudi menu');
 menu.setAttribute('aria-label','Menu principale');
 let wasOpen=false;
 function sync(){
  const open=menu.classList.contains('open');
  trigger.setAttribute('aria-expanded',String(open));menu.inert=!open;
  if(open && !wasOpen) (close || menu.querySelector('a'))?.focus();
  if(!open && wasOpen)trigger.focus();
  wasOpen=open;
 }
 sync();new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['class']});
 menu.querySelectorAll('.offcanvas-dropdown-toggle').forEach(toggle=>{
  toggle.setAttribute('role','button');toggle.tabIndex=0;
  const update=()=>toggle.setAttribute('aria-expanded',String(toggle.parentElement.classList.contains('active')));
  update();new MutationObserver(update).observe(toggle.parentElement,{attributes:true,attributeFilter:['class']});
  toggle.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();toggle.click();}});
 });
 const current=location.pathname.split('/').pop() || 'index.html';
 menu.querySelectorAll('a[href]').forEach(a=>{
  const filename=new URL(a.href).pathname.split('/').pop() || 'index.html';
  if(filename===current)a.setAttribute('aria-current','page');
 });
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){close?.click();return;}
  if(event.key!=='Tab')return;
  const items=[...menu.querySelectorAll('a[href],button,[tabindex="0"]')].filter(e=>e.getClientRects().length && e.offsetHeight>0 && getComputedStyle(e).visibility!=='hidden');
  const first=items[0],last=items.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
 });
})();
