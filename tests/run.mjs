import puppeteer from 'puppeteer-core';
import fs from 'fs';
const base='http://localhost:8053';
const out='/tmp/shots53';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
let fails=[];
const check=(name,ok,extra='')=>{console.log((ok?'PASS':'FAIL')+' '+name+(extra?' — '+extra:''));if(!ok)fails.push(name);};
for(const v of [{name:'desktop',w:1440,h:900},{name:'mobile',w:390,h:844}]){
 for(const theme of ['light','dark']){
  const page=await browser.newPage();
  await page.setViewport({width:v.w,height:v.h,deviceScaleFactor:1});
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.evaluateOnNewDocument(t=>{localStorage.clear();localStorage.setItem('theme',t);},theme);
  await page.goto(base,{waitUntil:'networkidle2'});
  await page.click('#btnSample');await new Promise(s=>setTimeout(s,400));
  const cards=await page.$$eval('#productList > .card',els=>els.length);
  check(`${v.name}/${theme} 3 products listed`,cards===3,cards+' cards');
  // open first product (Basmati - has target + unit)
  await page.click('#productList [data-open]');
  await page.waitForSelector('#compare:not(.hidden)');
  await new Promise(s=>setTimeout(s,500));
  const bestChip=await page.$eval('#tblCmp .chip-ok',e=>e.textContent).catch(()=>null);
  check(`${v.name}/${theme} best-deal chip`,!!bestChip,bestChip||'');
  const perUnit=await page.$$eval('#tblCmp tbody tr:first-child td',tds=>tds.map(t=>t.textContent));
  check(`${v.name}/${theme} per-unit column`,perUnit.some(t=>t.includes('87.80')),JSON.stringify(perUnit.slice(-2)));
  const stats=await page.$eval('#cmpStats',e=>e.textContent);
  check(`${v.name}/${theme} savings stat`,stats.includes('save'),'');
  // add a price under target -> alert
  await page.click('#btnAddPrice');
  await page.type('#prShop','TestShop');await page.type('#prPrice','430');await page.type('#prShip','0');
  await page.click('#pmSave');await new Promise(s=>setTimeout(s,400));
  const newBest=await page.$eval('#tblCmp tbody tr:first-child',e=>e.textContent);
  check(`${v.name}/${theme} new best after add`,newBest.includes('TestShop')&&newBest.includes('430'),'');
  // history chart
  const canv=await page.$eval('#chHist',c=>c.width>0);
  check(`${v.name}/${theme} history chart`,canv);
  // persistence: fresh page without the storage-clearing hook
  const p2=await browser.newPage();
  await p2.setViewport({width:v.w,height:v.h,deviceScaleFactor:1});
  await p2.goto(base,{waitUntil:'networkidle2'});await new Promise(s=>setTimeout(s,400));
  const persisted=await p2.$$eval('#productList > .card',els=>els.length);
  check(`${v.name}/${theme} persists after reload`,persisted===3,persisted+' cards');
  await p2.close();
  await page.screenshot({path:`${out}/compare-${v.name}-${theme}.png`});
  check(`${v.name}/${theme} no console errors`,errs.length===0,errs.slice(0,3).join('|'));
  await page.close();
 }
}
await browser.close();
if(fails.length){console.log('\nFAILURES: '+fails.join(', '));process.exit(1);}
console.log('\nALL PASS');
