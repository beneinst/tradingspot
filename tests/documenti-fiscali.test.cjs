const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer(async(req,res)=>{
  try {
   const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(!file.startsWith(root+path.sep)) {res.writeHead(403);return res.end();}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/backup.html');
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Archivio pronto'));
  await page.evaluate(()=>localStorage.setItem('cryptoOperations','[{"amount":12,"type":"ATOM","costEur":50}]'));
  const fixture={name:'ricevuta.txt',mimeType:'text/plain',buffer:Buffer.from('Documento fiscale di prova — 2025')};
  await page.locator('#docs-year').fill('2025');await page.locator('#docs-category').selectOption('Ricevuta');
  await page.locator('#docs-notes').fill('<img src=x onerror=alert(1)> Nota test');
  await page.locator('#docs-files').setInputFiles(fixture);await page.locator('#docs-save').click();
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.startsWith('1 documenti archiviati'));
  assert.equal(await page.locator('.docs-record').count(),1);
  assert.equal(await page.locator('.docs-record img').count(),0);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Archivio pronto'));
  assert.equal(await page.locator('.docs-record').count(),1);
  await page.locator('#docs-files').setInputFiles(fixture);await page.locator('#docs-save').click();
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('1 duplicati'));
  await page.getByRole('button',{name:'Modifica: ricevuta.txt',exact:true}).click();
  await page.locator('#docs-year').fill('2024');await page.locator('#docs-save').click();
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent==='Informazioni aggiornate.');
  await page.locator('#docs-search').fill('inesistente');assert.equal(await page.locator('.docs-record').count(),0);
  await page.locator('#docs-search').fill('');await page.locator('#docs-filter-year').selectOption('2024');assert.equal(await page.locator('.docs-record').count(),1);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#docs-export').click()]);
  const archive=await fs.readFile(await download.path());const parsed=JSON.parse(archive);
  assert.equal(parsed.documents[0].year,2024);
  const [single]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Scarica: ricevuta.txt',exact:true}).click()]);
  assert.deepEqual(await fs.readFile(await single.path()),fixture.buffer);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Elimina: ricevuta.txt',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Documento eliminato'));
  assert.equal(await page.locator('.docs-record').count(),0);
  await page.locator('#docs-import-file').setInputFiles({name:'archivio.json',mimeType:'application/json',buffer:archive});
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.startsWith('1 documenti ripristinati'));
  const [restored]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Scarica: ricevuta.txt',exact:true}).click()]);
  assert.deepEqual(await fs.readFile(await restored.path()),fixture.buffer);
  await page.locator('#docs-import-file').setInputFiles({name:'archivio.json',mimeType:'application/json',buffer:archive});
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.startsWith('0 documenti ripristinati'));
  parsed.documents[0].id='bad';
  await page.locator('#docs-import-file').setInputFiles({name:'danneggiato.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(parsed))});
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Archivio danneggiato'));
  assert.equal(await page.locator('.docs-record').count(),1);
  await page.locator('#docs-files').setInputFiles({name:'script.html',mimeType:'text/html',buffer:Buffer.from('<script>1</script>')});
  await page.locator('#docs-save').click();await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Documento non valido'));
  const alertPromise=page.waitForEvent('dialog').then(async d=>{assert.match(d.message(),/Importa archivio documenti/);await d.accept();});
  await page.locator('#file-upload-backup').setInputFiles({name:'archivio.json',mimeType:'application/json',buffer:archive});await alertPromise;
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cryptoOperations'))[0].costEur),50);
  for(const width of [390,768,1440]) {
   await page.setViewportSize({width,height:900});await page.locator('#docs-panel').scrollIntoViewIfNeeded();
   const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(sizes.scroll<=sizes.width,`Overflow at ${width}: ${JSON.stringify(sizes)}`);
  }
  await page.reload();await page.waitForFunction(()=>document.querySelector('#docs-status').textContent.includes('Archivio pronto'));
  await page.getByRole('button',{name:'Modifica: ricevuta.txt',exact:true}).click();await page.locator('#docs-notes').fill('Ricevuta annuale — documento dimostrativo');await page.locator('#docs-save').click();
  await page.waitForFunction(()=>document.querySelector('#docs-status').textContent==='Informazioni aggiornate.');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#docs-panel').screenshot({path:path.join(require('node:os').tmpdir(),'flowchart-archivio-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#docs-panel').screenshot({path:path.join(require('node:os').tmpdir(),'flowchart-archivio-desktop.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: upload, persistence, deduplication, metadata edit, filters, byte-exact download/export/restore, damaged archive, wrong-file protection, unsafe text, mobile/tablet/desktop layout, no browser errors.');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
