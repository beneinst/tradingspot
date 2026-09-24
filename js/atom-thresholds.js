(() => {
 'use strict';
 const key='atomPurchaseThresholdPercent';
 let snapshot=null, fresh=false;
 const $=id=>document.getElementById(id);
 const euro=n=>n.toLocaleString('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:4,maximumFractionDigits:4});
 const pct=n=>(n>0?'+':'')+n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
 function calculate(qty,invested,price,discount){
  if(![qty,invested,price,discount].every(Number.isFinite)||qty<=0||invested<=0||price<=0||discount<=0||discount>=100)return null;
  const breakEven=invested/qty, difference=(price/breakEven-1)*100,limit=breakEven*(1-discount/100);
  return {breakEven,difference,limit,reached:price<=limit,position:Math.abs(difference)<.005?'equal':difference>0?'above':'below'};
 }
 function render(){
  if(!$('atom-threshold-status')||!snapshot)return;
  const {qty,invested,price}=snapshot, input=$('atom-threshold-discount');
  const discount=Number(input.value), result=calculate(qty,invested,price,discount);
  $('atom-threshold-grid').replaceChildren();
  const status=$('atom-threshold-status');status.dataset.state='neutral';
  if(!input.validity.valid||!Number.isFinite(discount)||discount<=0||discount>=100){status.textContent='Inserisci una percentuale tra 0,1 e 99.';$('atom-threshold-detail').textContent='La soglia precedente resta salvata fino a un valore valido.';return;}
  if(!result||!fresh){status.textContent=!qty||qty<=0||!invested||invested<=0?'Dati insufficienti per le soglie':'Prezzo non aggiornato';$('atom-threshold-detail').textContent=!fresh?'Attendi un prezzo aggiornato: le soglie non sono attive durante un errore di rete.':'Servono quantità ATOM e capitale investito positivi.';return;}
  status.dataset.state=result.position;
  status.textContent=result.position==='equal'?'⚖️ In pareggio':result.position==='above'?'🟢 Sopra il pareggio · '+pct(result.difference):'🔴 Sotto il pareggio · '+pct(result.difference);
  $('atom-threshold-detail').textContent=`Prezzo attuale ${euro(price)} · Pareggio ${euro(result.breakEven)}. `+(result.position==='below'?'Un acquisto a questo prezzo ridurrebbe il costo medio, prima delle commissioni.':result.position==='above'?'Un acquisto a questo prezzo aumenterebbe il costo medio.':'Un acquisto a questo prezzo lascerebbe invariato il costo medio, prima delle commissioni.');
  const selected=document.createElement('div');selected.className='threshold-level threshold-selected';selected.dataset.reached=String(result.reached);
  const title=document.createElement('strong');title.textContent=`La tua soglia: −${discount}% · ${euro(result.limit)}`;
  const text=document.createElement('p');text.textContent=result.reached?'🔵 Soglia raggiunta: prezzo al limite impostato o inferiore.':`Soglia non raggiunta. Variazione dal prezzo attuale per raggiungerla: ${pct((result.limit/price-1)*100)}.`;
  selected.append(title,text);$('atom-threshold-grid').append(selected);
  [-20,-10,-5,0,5,10,20].forEach(level=>{
   const value=result.breakEven*(1+level/100),card=document.createElement('div');card.className='threshold-level';
   const heading=document.createElement('strong');heading.textContent=(level===0?'Pareggio':(level>0?'+':'')+level+'%')+' · '+euro(value);
   const label=document.createElement('p');label.textContent=level<0?(price<=value?'Prezzo a questa fascia o sotto':'Prezzo sopra questa fascia'):level>0?(price>=value?'Livello superato o raggiunto':'Livello non raggiunto'):'Riferimento del wallet';
   card.dataset.tone=level<0?'below':level>0?'above':'equal';card.append(heading,label);$('atom-threshold-grid').append(card);
  });
 }
 window.AtomThresholds={calculate,update(values){snapshot=values;render();},setPriceState(value){fresh=value;render();}};
 document.addEventListener('DOMContentLoaded',()=>{
  const input=$('atom-threshold-discount');
  try{const stored=Number(localStorage.getItem(key));if(stored>0&&stored<100)input.value=stored;}catch{}
  input.addEventListener('input',()=>{if(input.validity.valid&&Number(input.value)>0&&Number(input.value)<100){try{localStorage.setItem(key,input.value);}catch{}}render();});
  render();
 });
})();
