/* Rendering dedicato agli export: il grafico a schermo non viene ridimensionato. */
(() => {
 'use strict';
 const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)]));
  return value;
 }
 function save(content,name,type='text/html;charset=utf-8') {
  const blob=content instanceof Blob?content:new Blob([content],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 async function chartPNG(id,title) {
  const source=window.Chart?.getChart(document.getElementById(id));
  if(!source) throw Error('Grafico non ancora disponibile. Attendi il caricamento e riprova.');
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
  const options=copy(source.config.options);
  Object.assign(options,{responsive:false,maintainAspectRatio:false,devicePixelRatio:2,animation:false,events:[]});
  options.plugins={...options.plugins,title:{display:true,text:[title,'FlowChart · '+new Date().toLocaleString('it-IT')],color:'#e2ece5',font:{family:'Arial',size:22},padding:24},legend:{...options.plugins?.legend,display:true,position:'bottom',labels:{...options.plugins?.legend?.labels,color:'#d7e3db',font:{family:'Arial',size:14},padding:18,boxWidth:24}}};
  Object.values(options.scales||{}).forEach(scale=>{scale.ticks={...scale.ticks,color:'#c5d3ca',font:{family:'Arial',size:13}};scale.grid={...scale.grid,color:'rgba(200,220,205,.10)'};});
  const data=copy(source.config.data);
  data.datasets.forEach((dataset,i)=>{dataset.hidden=!source.isDatasetVisible(i);});
  let chart;
  try {
   chart=new Chart(canvas,{type:source.config.type,data,options,plugins:[{id:'exportBackground',beforeDraw(c){const ctx=c.ctx;ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#111c16';ctx.fillRect(0,0,c.width,c.height);ctx.restore();}}]});
   chart.update('none');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('Impossibile generare l’immagine.');
   save(blob,`${id}-${new Date().toISOString().slice(0,10)}-HD.png`);
  } finally {chart?.destroy();}
 }
 const reportCSS=`
 *{box-sizing:border-box}html{background:#edf1ee}body{font-family:Arial,Helvetica,sans-serif!important;color:#1c3024!important;background:#fff!important;max-width:1200px;margin:32px auto!important;padding:40px!important;line-height:1.5;font-size:13px}
 body>.container,main{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:white!important;box-shadow:none!important;border:0!important}
 h1{font:700 27px/1.25 Arial!important;color:#1d4930!important;letter-spacing:-.5px;margin:0 0 14px!important}h2,h3{font-family:Arial!important;color:#28583c!important;break-after:avoid}h2{font-size:18px!important;margin-top:30px!important}
 table{width:100%!important;border-collapse:collapse!important;font-size:12px!important;table-layout:auto!important;margin:18px 0 28px!important}thead{display:table-header-group!important}tbody{display:table-row-group!important}tr{break-inside:avoid}th,td{padding:10px 9px!important;border:0!important;border-bottom:1px solid #dbe4dd!important;vertical-align:top!important;overflow-wrap:anywhere;white-space:normal!important;color:#203529!important}th{background:#e5eee7!important;color:#204c32!important;font-weight:700!important;text-align:left}tbody tr:nth-child(even){background:#f5f8f5!important}tfoot td{background:#eaf1eb!important;font-weight:bold}.right,.num{text-align:right;font-variant-numeric:tabular-nums}.positive,.val-green{color:#187140!important}.negative,.val-red{color:#b43535!important}.footer,.report-meta,.export-date{color:#627368!important;font-size:11px}.report-meta{margin-bottom:26px}.report-summary{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.report-summary>div{flex:1 1 150px;padding:14px;background:#f1f6f2;border-radius:8px}.report-summary .label{display:block;font-size:11px;color:#53665a}.report-summary .value{display:block;font-size:17px;font-weight:bold}.report-table{overflow:visible!important}
 @page{size:A4 landscape;margin:14mm}@media print{html,body{background:#fff!important}body{max-width:none;margin:0!important;padding:0!important;font-size:10pt}table{font-size:9pt!important}thead{display:table-header-group}h1{font-size:21pt!important}a{color:inherit;text-decoration:none}}@media(max-width:700px){body{margin:0!important;padding:18px!important}table{font-size:10px!important}td,th{padding:7px 5px!important}}
 `;
 function polish(html) {
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script,iframe,object,embed,button,input,select,textarea').forEach(el=>el.remove());
  doc.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(a.name.startsWith('on') || (['href','src'].includes(a.name)&&/^javascript:/i.test(a.value)))el.removeAttribute(a.name);});});
  const style=doc.createElement('style');style.textContent=reportCSS;doc.head.append(style);
  if(!doc.querySelector('meta[name=viewport]')) {const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width, initial-scale=1';doc.head.append(meta);}
  return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;
 }
 function walletReport(asset) {
  const table=document.querySelector('#portfolio table');
  if(!table){alert('Nessun movimento da esportare.');return;}
  const clone=table.cloneNode(true);
  const actionColumns=[...clone.querySelectorAll('thead th')].map((th,i)=>/azioni/i.test(th.textContent)?i:-1).filter(i=>i>=0).reverse();
  clone.querySelectorAll('tr').forEach(row=>actionColumns.forEach(i=>row.children[i]?.remove()));
  const summary=document.getElementById('totalsRow')?.innerHTML||'';
  const priceTime=document.getElementById('priceUpdated')?.textContent||'';
  const html=`<html lang="it"><head><meta charset="utf-8"><title>Resoconto ${asset} — FlowChart</title></head><body><h1>Resoconto Wallet ${asset}</h1><p class="report-meta">Generato il ${escape(new Date().toLocaleString('it-IT'))} · Valori in EUR<br>Prezzo: ${escape(priceTime)}</p><div class="report-summary">${summary}</div><h2>Dettaglio movimenti</h2><div class="report-table">${clone.outerHTML}</div><p class="footer">FlowChart by Gerardo D · Resoconto del tracker</p></body></html>`;
  save(polish(html),`resoconto-${asset.toLowerCase()}-${new Date().toISOString().slice(0,10)}.html`);
 }
 window.FlowExport={chartPNG,polish};
 document.addEventListener('DOMContentLoaded',()=>{
  const charts={usdComparisonChart:'ATOM · Capitale e valore',capitalChart:'ATOM · Andamento capitale',btcChart:'Wallet BTC',usdcChart:'Wallet USDC'};
  Object.entries(charts).forEach(([id,title])=>{
   const canvas=document.getElementById(id);if(!canvas)return;
   const row=document.createElement('div');row.className='export-buttons';
   const button=document.createElement('button');button.className='btn-edit';button.textContent='📈 Scarica grafico HD';button.type='button';
   button.onclick=async()=>{button.disabled=true;try{await chartPNG(id,title);}catch(e){alert(e.message);}finally{button.disabled=false;}};
   row.append(button);canvas.parentElement.after(row);
  });
  ['btc','usdc'].forEach(asset=>{
   const csv=document.getElementById('btnDownload_'+asset);if(!csv)return;
   csv.textContent='📥 Scarica CSV';
   const button=document.createElement('button');button.className='btn-edit';button.type='button';button.textContent='📄 Resoconto stampabile';button.onclick=()=>walletReport(asset.toUpperCase());csv.after(button);
   csv.parentElement.style.flexWrap='wrap';csv.parentElement.style.gap='12px';
  });
 });
})();
