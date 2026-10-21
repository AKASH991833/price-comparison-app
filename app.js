/* Price Comparison - localStorage CRUD, effective-price ranking, history, alerts */
(function(){
'use strict';
const LS='pricecmp-v1';
let DB={products:[]};
let current=null, chart=null, editingPrice=null;
function save(){localStorage.setItem(LS,JSON.stringify(DB));}
function load(){try{const d=JSON.parse(localStorage.getItem(LS));if(d&&Array.isArray(d.products))DB=d;}catch(e){}}
load();
const uid=()=>Math.random().toString(36).slice(2,9);
const today=()=>new Date().toISOString().slice(0,10);
const eff=p=>p.price+(p.ship||0);
function bestOf(prod){if(!prod.prices.length)return null;return prod.prices.slice().sort((a,b)=>eff(a)-eff(b))[0];}
function perUnit(prod,p){if(!prod.unit||!p)return null;return eff(p)/prod.unit;}

/* ---------- sample ---------- */
document.getElementById('btnSample').addEventListener('click',()=>{
  const d=days=>new Date(Date.now()-days*864e5).toISOString().slice(0,10);
  DB={products:[
    {id:uid(),name:'Basmati rice 5 kg',target:480,unit:5,unitLabel:'kg',prices:[
      {id:uid(),shop:'DMart',date:d(21),price:449,ship:0},{id:uid(),shop:'Amazon',date:d(21),price:419,ship:40},
      {id:uid(),shop:'Blinkit',date:d(14),price:475,ship:25},{id:uid(),shop:'DMart',date:d(7),price:439,ship:0},
      {id:uid(),shop:'Local kirana',date:d(2),price:455,ship:0}]},
    {id:uid(),name:'Boat Airdopes 141',target:999,unit:null,unitLabel:'',prices:[
      {id:uid(),shop:'Amazon',date:d(30),price:1299,ship:0},{id:uid(),shop:'Flipkart',date:d(30),price:1249,ship:0},
      {id:uid(),shop:'Flipkart',date:d(10),price:1099,ship:0},{id:uid(),shop:'Croma',date:d(10),price:1199,ship:0},
      {id:uid(),shop:'Amazon',date:d(3),price:999,ship:0}]},
    {id:uid(),name:'Amul gold milk 1 L',target:null,unit:1,unitLabel:'L',prices:[
      {id:uid(),shop:'Local kirana',date:d(5),price:66,ship:0},{id:uid(),shop:'Blinkit',date:d(5),price:66,ship:25},
      {id:uid(),shop:'DMart',date:d(2),price:64,ship:0}]}
  ]};
  save();renderAll();toast('Sample tracker loaded');
});

/* ---------- render ---------- */
function renderAll(){renderStats();renderList();if(current)renderCompare();}
function renderStats(){
  const ps=DB.products;
  const deals=ps.filter(p=>{const b=bestOf(p);return p.target&&b&&eff(b)<=p.target;});
  const savings=ps.reduce((s,p)=>{if(p.prices.length<2)return s;const es=p.prices.map(eff);return s+(Math.max(...es)-Math.min(...es));},0);
  document.getElementById('statsRow').innerHTML=[
    ['Products tracked',ps.length,'var(--accent)'],
    ['At or under target',deals.length,deals.length?'var(--ok)':'var(--muted)'],
    ['Best-vs-worst spread',ps.length?'₹'+fmtNum(savings,0):'-',savings>0?'var(--ok)':'var(--muted)']
  ].map(([l,v,c])=>`<div class="card stat"><div class="stat-label">${l}</div><div class="stat-value" style="color:${c}">${v}</div></div>`).join('');
}
function renderList(){
  const el=document.getElementById('productList');
  if(!DB.products.length){el.innerHTML='<div class="card empty"><div class="tile-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/></svg></div><h3>No products yet</h3><p>Add your first product or load the sample tracker.</p></div>';return;}
  el.innerHTML=DB.products.map(p=>{
    const b=bestOf(p);
    const deal=p.target&&b&&eff(b)<=p.target;
    return `<div class="card card-hover row row-wrap" data-open="${p.id}" role="button" tabindex="0">
      <div class="grow">
        <div class="row" style="gap:10px"><b style="font-size:1.05rem">${esc(p.name)}</b>${deal?'<span class="chip chip-ok">Deal: under target</span>':''}${p.unit?`<span class="chip">${p.unit} ${esc(p.unitLabel||'')}</span>`:''}</div>
        <small>${p.prices.length} price${p.prices.length===1?'':'s'} logged${p.target?' · target ₹'+fmtNum(p.target,0):''}</small>
      </div>
      ${b?`<div class="tar"><div style="font-weight:800;font-size:1.25rem;color:var(--ok)">₹${fmtNum(eff(b),0)}</div><small>best at ${esc(b.shop)}${perUnit(p,b)?' · ₹'+perUnit(p,b).toFixed(1)+'/'+esc(p.unitLabel||'unit'):''}</small></div>`:'<small class="muted">No prices yet</small>'}
      <button class="btn btn-ghost btn-icon" data-del="${p.id}" aria-label="Delete product"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
    </div>`;}).join('');
  el.querySelectorAll('[data-open]').forEach(c=>{c.addEventListener('click',e=>{if(e.target.closest('[data-del]'))return;openCompare(c.dataset.open);});
    c.addEventListener('keydown',e=>{if(e.key==='Enter')openCompare(c.dataset.open);});});
  el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Delete this product and its prices?')){DB.products=DB.products.filter(p=>p.id!==b.dataset.del);save();current=null;document.getElementById('compare').classList.add('hidden');renderAll();}}));
}
function openCompare(id){current=DB.products.find(p=>p.id===id);document.getElementById('compare').classList.remove('hidden');renderCompare();document.getElementById('compare').scrollIntoView({behavior:'smooth'});}
function renderCompare(){
  const p=current;if(!p)return;
  document.getElementById('cmpTitle').textContent=p.name;
  document.getElementById('cmpSub').textContent=(p.target?'Target ₹'+fmtNum(p.target,0)+' · ':'')+(p.unit?p.unit+' '+(p.unitLabel||'units')+' pack':'');
  const sorted=p.prices.slice().sort((a,b)=>eff(a)-eff(b));
  const es=sorted.map(eff);
  const best=es[0],worst=es[es.length-1],avg=es.reduce((a,b)=>a+b,0)/es.length;
  document.getElementById('cmpStats').innerHTML=sorted.length?[
    ['Best effective price','₹'+fmtNum(best,0),'var(--ok)',sorted[0].shop],
    ['Worst', '₹'+fmtNum(worst,0),'var(--bad)',sorted[sorted.length-1].shop],
    ['You save vs worst','₹'+fmtNum(worst-best,0),best<worst?'var(--ok)':'var(--muted)','avg ₹'+fmtNum(avg,0)]
  ].map(([l,v,c,d])=>`<div class="card stat"><div class="stat-label">${l}</div><div class="stat-value" style="color:${c};font-size:1.4rem">${v}</div><div class="stat-delta muted">${d}</div></div>`).join(''):'<p class="muted">No prices yet - add the first one.</p>';
  document.getElementById('tblCmp').innerHTML=sorted.length?'<thead><tr><th></th><th>Shop</th><th>Date</th><th class="num">Price</th><th class="num">Shipping</th><th class="num">Effective</th>'+(p.unit?'<th class="num">Per '+esc(p.unitLabel||'unit')+'</th>':'')+'<th></th></tr></thead><tbody>'+
    sorted.map((pr,i)=>{const hit=p.target&&eff(pr)<=p.target;
      return `<tr><td>${i===0?'<span class="chip chip-ok">Best</span>':hit?'<span class="chip chip-ok">Under target</span>':''}</td><td style="font-weight:600">${esc(pr.shop)}</td><td class="mono" style="white-space:nowrap">${pr.date}</td><td class="num mono">₹${fmtNum(pr.price)}</td><td class="num mono">${pr.ship?'₹'+fmtNum(pr.ship):'-'}</td><td class="num mono" style="font-weight:700">₹${fmtNum(eff(pr))}</td>${p.unit?'<td class="num mono">₹'+perUnit(p,pr).toFixed(2)+'</td>':''}<td><button class="btn btn-ghost btn-sm" data-pdel="${pr.id}">Delete</button></td></tr>`;}).join('')+'</tbody>':'';
  document.querySelectorAll('[data-pdel]').forEach(b=>b.addEventListener('click',()=>{p.prices=p.prices.filter(x=>x.id!==b.dataset.pdel);save();renderAll();}));
  drawHistory(p);
}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function drawHistory(p){
  if(chart){chart.destroy();chart=null;}
  if(!p.prices.length)return;
  const byDate={};p.prices.forEach(pr=>{const k=pr.date;(byDate[k]=byDate[k]||[]).push(eff(pr));});
  const dates=Object.keys(byDate).sort();
  const min=dates.map(d=>Math.min(...byDate[d])),avg=dates.map(d=>byDate[d].reduce((a,b)=>a+b,0)/byDate[d].length);
  const ds=[{label:'Best price that day',data:min,borderColor:'var(--ok)',backgroundColor:'#10b981',tension:.3,pointRadius:4},{label:'Average that day',data:avg,borderColor:'#94a3b8',backgroundColor:'#94a3b8',borderDash:[5,4],tension:.3,pointRadius:3}];
  if(p.target)ds.push({label:'Target',data:dates.map(()=>p.target),borderColor:'#dc2626',borderDash:[6,5],pointRadius:0,borderWidth:1.5});
  chart=new Chart(document.getElementById('chHist'),{type:'line',data:{labels:dates,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:css('--ink-2'),boxWidth:12}}},scales:{x:{ticks:{color:css('--muted')},grid:{color:css('--border')}},y:{ticks:{color:css('--muted'),callback:v=>'₹'+v},grid:{color:css('--border')}}}}});
}

/* ---------- product add ---------- */
const addCard=document.getElementById('addCard');
document.getElementById('btnAdd').addEventListener('click',()=>{addCard.classList.remove('hidden');document.getElementById('pName').focus();});
document.getElementById('btnAddCancel').addEventListener('click',()=>addCard.classList.add('hidden'));
document.getElementById('btnAddSave').addEventListener('click',()=>{
  const name=document.getElementById('pName').value.trim();
  if(!name){toast('Give the product a name');return;}
  DB.products.push({id:uid(),name,target:parseFloat(document.getElementById('pTarget').value)||null,unit:parseFloat(document.getElementById('pUnit').value)||null,unitLabel:document.getElementById('pUnitLabel').value.trim(),prices:[]});
  ['pName','pTarget','pUnit','pUnitLabel'].forEach(id=>document.getElementById(id).value='');
  addCard.classList.add('hidden');save();renderAll();toast('Product added');
});

/* ---------- price modal ---------- */
const modal=document.getElementById('priceModal');
document.getElementById('btnAddPrice').addEventListener('click',()=>{if(!current)return;document.getElementById('pmProduct').textContent=current.name;document.getElementById('prDate').value=today();modal.classList.remove('hidden');document.getElementById('prShop').focus();});
document.getElementById('pmCancel').addEventListener('click',()=>modal.classList.add('hidden'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});
document.getElementById('pmSave').addEventListener('click',()=>{
  const shop=document.getElementById('prShop').value.trim(),price=parseFloat(document.getElementById('prPrice').value);
  if(!shop||isNaN(price)){toast('Shop and price are required');return;}
  current.prices.push({id:uid(),shop,date:document.getElementById('prDate').value||today(),price,ship:parseFloat(document.getElementById('prShip').value)||0});
  ['prShop','prPrice','prShip'].forEach(id=>document.getElementById(id).value='');
  modal.classList.add('hidden');save();renderAll();
  if(current.target&&eff(current.prices[current.prices.length-1])<=current.target)toast('Under your target price!');
});
document.getElementById('btnBack').addEventListener('click',()=>{document.getElementById('compare').classList.add('hidden');current=null;});

/* ---------- backup ---------- */
document.getElementById('btnExport').addEventListener('click',()=>download('price-tracker-backup.json',JSON.stringify(DB,null,2),'application/json'));
document.getElementById('impFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!Array.isArray(d.products))throw 0;DB=d;save();renderAll();toast('Backup imported');}catch(x){toast('That file is not a valid backup');}};
  r.readAsText(f);
});
document.getElementById('btnClear').addEventListener('click',()=>{if(confirm('Delete ALL tracked products and prices from this browser?')){DB={products:[]};save();current=null;document.getElementById('compare').classList.add('hidden');renderAll();}});
renderAll();
window._test={get DB(){return DB;},bestOf,eff};
})();
