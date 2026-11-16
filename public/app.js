/* TLW Intel client — demo + documented lastintel MCP via private Node API.
   Provider results are shown to the current operator only and never exported. */
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={
  mode:'demo',page:'overview',tokenConfigured:false,account:null,jobs:[],
  selected:null,search:[],taskResults:[],lastLocate:null,liveMap:[],
  saved:loadSaved(),reward:'all',scope:'auto',modalAction:null,
  map:{zoom:1,centerX:500,centerY:500,drag:null,extent:1000,hover:null}
};
const REWARDS=[
 {id:'all',icon:'◎',label:'All rewards'},
 {id:'Upgrade Ore',icon:'🔷',label:'Upgrade Ore'},
 {id:'Skill Medal',icon:'🏅',label:'Skill Medal'},
 {id:'5m Construction Speed-up',icon:'⏩',label:'Construction 5m'},
 {id:'5m Research Speed-up',icon:'🧪',label:'Research 5m'},
 {id:'5m Training Speed-up',icon:'⚔️',label:'Training 5m'},
 {id:'5-min Speed-up Chest',icon:'🎁',label:'Speed-up Chest'}
];
const DEMO_COMMANDERS=[
 {id:'sample_01',type:'commander',name:'SAMPLE · Iron Ranger',tag:'DEMO',serverId:2079,power:201800000,x:246,y:943},
 {id:'sample_02',type:'commander',name:'SAMPLE · Fire Scout',tag:'TEST',serverId:2079,power:160100000,x:731,y:390},
 {id:'sample_03',type:'commander',name:'SAMPLE · Night Hawk',tag:'TEST',serverId:2064,power:118600000,x:551,y:712},
 {id:'sample_04',type:'commander',name:'SAMPLE · Silver Fox',tag:'DEMO',serverId:2079,power:177100000,x:188,y:582}
];
const DEMO_TASKS=[
 {id:'task_demo_1',name:'SAMPLE · Golden Recovery',alliance:'DEMO',warzone:2080,x:371,y:592,reward:'Upgrade Ore',amount:'12 units',kind:'task'},
 {id:'task_demo_2',name:'SAMPLE · Elite Mission',alliance:'DEMO',warzone:2064,x:726,y:370,reward:'Skill Medal',amount:'6 medals',kind:'task'},
 {id:'task_demo_3',name:'SAMPLE · Supply Chase',alliance:'TEST',warzone:2078,x:472,y:241,reward:'5m Research Speed-up',amount:'16 packs',kind:'task'},
 {id:'task_demo_4',name:'SAMPLE · Victory Reserve',alliance:'TEST',warzone:2079,x:612,y:648,reward:'Upgrade Ore',amount:'8 units',kind:'task'},
 {id:'task_demo_5',name:'SAMPLE · Drill Mission',alliance:'DEMO',warzone:2079,x:119,y:208,reward:'5m Training Speed-up',amount:'9 packs',kind:'task'},
 {id:'task_demo_6',name:'SAMPLE · Construction Cache',alliance:'TEST',warzone:2079,x:818,y:719,reward:'5m Construction Speed-up',amount:'12 packs',kind:'task'}
];
function loadSaved(){ try {const x=JSON.parse(localStorage.getItem('tlw-targets-v1')||'[]');return Array.isArray(x)?x.slice(0,5000):[]}catch{return []} }
function saveLocal(){localStorage.setItem('tlw-targets-v1',JSON.stringify(ui.saved));renderSaved();renderMap();refreshStats()}
function notify(message,type='info'){
 const e=$('notice');e.textContent=message;e.className='notice '+(type==='error'?'err':type==='warning'?'warn':'');e.hidden=false;
 e.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function clearNotice(){$('notice').hidden=true}
async function api(action,params={}){
 const headers={'Content-Type':'application/json'};
 const key=sessionStorage.getItem('tlw-access-code');if(key)headers['X-TLW-Access-Code']=key;
 const res=await fetch('/api/intel',{method:'POST',headers,body:JSON.stringify({action,...params}),cache:'no-store'});
 let data;try{data=await res.json()}catch{throw new Error('Server returned an unexpected response.')}
 if(!res.ok||!data.ok)throw new Error(data.error||`Server error ${res.status}`);
 return data.data;
}
function go(page){
 if(!['overview','commander','tasks','map','saved'].includes(page))return;
 ui.page=page;clearNotice();document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!=='page-'+page));
 document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
 $('crumb').innerHTML='OPERATIONS <span>/</span> '+({overview:'OVERVIEW',commander:'COMMANDER LOCATOR',tasks:'SECRET TASK FINDER',map:'TACTICAL MAP',saved:'SAVED TARGETS'})[page];
 window.scrollTo({top:0,behavior:'auto'});if(page==='map')setTimeout(()=>{updateMapZones();drawMap()},50);if(page==='saved')renderSaved();
}
function refreshStats(){
 $('stat-targets').textContent=ui.saved.length;$('nav-count').textContent=ui.saved.length;
 $('stat-source').textContent=ui.mode==='demo'?'Demo':'Live';$('stat-source-sub').textContent=ui.mode==='demo'?'Fictional test data only':'Provider read / user targets';
 $('stat-credits').textContent=ui.mode==='live'?(ui.account?.credits??'—'):'—';
 $('stat-credit-sub').textContent=ui.mode==='demo'?'Switch to live to check':ui.account?'Current provider balance':'Connect token to view';
 $('task-balance').textContent=ui.mode==='demo'?'Demo mode':ui.account?`${ui.account.credits} credits`:'Token not configured';
 $('mode-label').textContent=ui.mode==='demo'?'◉ DEMO DATA':'◉ LIVE PROVIDER';
 $('mode-label').classList.toggle('live',ui.mode==='live');$('toggle-mode').textContent=ui.mode==='demo'?'Switch to live':'Use demo';
 $('map-state').textContent=ui.mode==='demo'?'SAMPLE DATA':'LOCAL / SESSION ONLY';
 updateCost();
}
async function switchMode(){
 ui.mode=ui.mode==='demo'?'live':'demo';ui.search=[];ui.selected=null;ui.lastLocate=null;ui.taskResults=[];ui.liveMap=[];
 renderSearch();renderSelected();renderTasks();refreshStats();renderMap();
 if(ui.mode==='live'){
  notify('Live mode enabled. Index search is free; paid scans require your own lastintel server API token and provider credits.','warning');
  await checkConnection();
 } else notify('Demo mode: all sample players, task rewards, positions and coordinates are fictional.');
}
async function checkConnection(){
 try {
  const health=await api('health');ui.tokenConfigured=health.tokenConfigured;
  if(health.tokenConfigured){
   try{ const data=await api('account');ui.account=data.account||null;ui.jobs=data.jobs||[];
      notify('Provider account connected. Paid searches require your confirmation before any credits are spent.');
   }catch(e){notify('Provider token found, but account access failed: '+e.message,'warning')}
  } else {ui.account=null;ui.jobs=[];notify('No live scan token is configured on this server. Free commander index searches may still work. Configure LASTINTEL_API_TOKEN to enable paid searches.','warning')}
 }catch(e){notify('Connection check failed: '+e.message,'error')}
 refreshStats();renderRewards();
}
function fmtPower(n){const v=Number(n);return Number.isFinite(v)?v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(1)+'M':v.toLocaleString():'—'}
function renderSearch(){
 $('search-count').textContent=ui.search.length+' found';
 const el=$('search-results');if(!ui.search.length){el.className='result-list empty-state';el.innerHTML='<div class="empty-icon">⌕</div><p>No commander results yet.</p>';return}
 el.className='result-list';
 el.innerHTML=ui.search.map((o,i)=>`<button class="search-row ${ui.selected?.id===o.id?'selected':''}" data-select="${i}"><div><div class="row-title">${esc(o.tag?'['+o.tag+'] ':'')}${esc(o.name)}</div><div class="row-sub">${esc(o.type||'commander')} · Warzone #${esc(o.serverId??'?')} ${ui.mode==='demo'?'· SAMPLE':''}</div></div><div class="row-right"><b>${fmtPower(o.power)}</b><small>POWER</small></div></button>`).join('');
 el.querySelectorAll('[data-select]').forEach(btn=>btn.addEventListener('click',()=>{
  const o=ui.search[Number(btn.dataset.select)];if(o.type==='alliance'){notify('Choose a commander row, not an alliance, to locate a base.','warning');return}
  ui.selected=o;if(o.serverId)$('locate-zones').value=String(o.serverId);renderSearch();renderSelected();
 }));
}
function renderSelected(){
 const o=ui.selected;
 $('selected-commander').className=o?'selected-box':'selected-empty';
 $('selected-commander').innerHTML=o?`<strong>${esc(o.name)}</strong><small>${esc(o.tag?'['+o.tag+']':'')} · Home #${esc(o.serverId)} · ${fmtPower(o.power)} power ${ui.mode==='demo'?'· DEMO':''}</small>`:'Select a commander from the results.';
 $('locate-button').disabled=!o;
 $('locate-result').innerHTML='';
}
async function doSearch(event){
 event.preventDefault();clearNotice();const query=$('search-query').value.trim();const zone=$('search-zone').value.trim();if(query.length<2)return;
 $('search-button').disabled=true;$('search-button').textContent='Searching…';
 try {
  if(ui.mode==='demo'){
   ui.search=DEMO_COMMANDERS.filter(c=>(c.name+' '+c.tag+' SAMPLE').toLowerCase().includes(query.toLowerCase())&&(!zone||String(c.serverId)===zone));
   if(!ui.search.length)notify('No fictional sample matched. Try “SAMPLE” or switch to Live for a real commander search.','warning');
  }else{
   const result=await api('search',{query,warzone:zone});ui.search=Array.isArray(result.items)?result.items:[];
   if(!ui.search.length)notify('No index matches returned by lastintel.','warning');
  }
  ui.selected=null;renderSelected();renderSearch();
 }catch(e){notify('Search failed: '+e.message,'error')}
 finally{$('search-button').disabled=false;$('search-button').textContent='⌕ Search'}
}
function scanQuote(jobType,scope){
 if(ui.mode==='demo')return 'DEMO · no credits';
 const job=ui.jobs.find(j=>j.type===jobType || (jobType==='secret_task'&&j.type==='secret'));
 if(!job)return 'Provider price unavailable';
 const n=scope?scope.split(/[\s,;]+/).filter(Boolean).length:0;
 if(jobType==='locate')return `${job.priceCredits??'Provider-priced'} credits for initial search; more warzones may cost extra`;
 if(n && ui.account?.scanUnit)return `Estimated ${n*ui.account.scanUnit} credits for ${n} warzone(s)`;
 return `${job.priceCredits??'Provider-priced'} credits (provider quote)`;
}
function showModal({title,description,extra='',button='Confirm',onConfirm}){
 $('modal-title').textContent=title;$('modal-text').textContent=description;
 $('modal-extra').innerHTML=extra;$('modal-ok').textContent=button;
 ui.modalAction=onConfirm;$('modal-root').classList.remove('hidden');
}
function hideModal(){$('modal-root').classList.add('hidden');ui.modalAction=null}
function parseZones(str,max){const a=[...new Set(String(str||'').split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean))];if(!a.length||a.length>max||!a.every(v=>/^\d{1,5}$/.test(v)&&Number(v)>=1))throw Error(`Enter 1–${max} numeric warzone IDs.`);return a.map(Number)}
async function locate(){
 if(!ui.selected)return;
 const scopes=$('locate-zones').value;
 let zones;try{zones=parseZones(scopes,10)}catch(e){notify(e.message,'error');return}
 if(ui.mode==='demo'){
  const match=DEMO_COMMANDERS.find(c=>c.id===ui.selected.id);
  const row={...match,warzone:match.serverId,kind:'base',alliance:match.tag};ui.lastLocate=row;
  $('locate-result').innerHTML=`<div class="success"><b>DEMO LOCATION ONLY</b><br>#${row.warzone} · X ${row.x} · Y ${row.y}<div class="target-actions"><button class="smallbtn" id="copy-locate">Copy sample coordinates</button></div></div>`;
  $('copy-locate').onclick=()=>copyCoords(row);return;
 }
 if(!ui.account){notify('Set up your lastintel API token before starting a paid commander search.','warning');return}
 showModal({title:'Confirm charged base locator',description:`Search ${ui.selected.name} across warzone(s) ${zones.join(', ')}. This sends a real paid request to lastintel.`,extra:`<div class="sensitive"><b>${esc(scanQuote('locate',scopes))}</b><br>Balance: ${esc(ui.account?.credits??'—')} credits. The provider determines actual charges. Do not repeat the request unless you intend another charge.</div>`,button:'Run paid search',onConfirm:async()=>{
  const data=await api('locate',{commanderId:ui.selected.id,warzones:zones,confirmed:true});
  const rows=extractItems(data);const loc=rows.map(v=>normTarget(v,'base')).find(v=>validXY(v));
  ui.lastLocate=loc||null;if(loc){ui.liveMap=[loc,...ui.liveMap.filter(v=>v.id!==loc.id)];updateMapZones()}
  $('locate-result').innerHTML=loc?`<div class="success">Located by provider: #${esc(loc.warzone)} · X ${loc.x} · Y ${loc.y}<div class="target-actions"><button class="smallbtn" id="copy-locate">Copy coordinate</button><button class="smallbtn orange" id="send-locate">Send in-game</button></div></div>`:`<div class="result-note">Search completed. No usable coordinate was returned in the provider response. Details: ${esc(JSON.stringify(data).slice(0,1000))}</div>`;
  if(loc){$('copy-locate').onclick=()=>copyCoords(loc);$('send-locate').onclick=()=>sendCoords(loc)}
  await checkConnection();
 }});
}
function getRewardOptions(){
 const job=ui.jobs.find(j=>j.type==='secret_task'||j.type==='secret');
 const item=(job?.options||[]).find(o=>o.key==='items');
 const opts=item?.choices||item?.values||item?.enum||[];
 return opts.map(c=> typeof c==='string'?{value:c,label:c}:{value:String(c.value??c.id??c.key??''),label:String(c.label??c.name??c.value??c.id??'')}).filter(v=>v.value);
}
function renderRewards(){
 const el=$('reward-options');const supported=getRewardOptions();
 let options=REWARDS;
 if(ui.mode==='live'&&supported.length){
  options=[REWARDS[0],...supported.map(c=>({id:c.value,label:c.label,icon:REWARDS.find(r=>r.label.toLowerCase()===c.label.toLowerCase())?.icon||'✧'}))];
  if(!options.some(v=>v.id===ui.reward))ui.reward='all';
 }
 el.innerHTML=options.map(r=>`<button type="button" class="reward ${ui.reward===r.id?'active':''}" data-reward="${esc(r.id)}"><span>${r.icon}</span><small>${esc(r.label)}</small></button>`).join('');
 el.querySelectorAll('[data-reward]').forEach(btn=>btn.onclick=()=>{ui.reward=btn.dataset.reward;renderRewards();if(ui.mode==='demo')renderTasks()});
 $('reward-helper').textContent=ui.mode==='demo'?'Fictional mission previews. No credit charges.':supported.length?'Choose a provider-supported reward; the scan sends its exact code.':'Provider reward codes unavailable. Select a visual preference, but scan requests All rewards and may require manual inspection.';
}
function updateCost(){
 const val=ui.scope==='custom'?$('task-zones').value:'';
 $('task-cost').textContent=scanQuote('secret_task',val);
}
function setScope(v){ui.scope=v;document.querySelectorAll('.scope').forEach(el=>el.classList.toggle('active',el.querySelector('input').value===v));$('task-zone-wrap').classList.toggle('hidden',v!=='custom');updateCost()}
function validXY(t){return Number.isFinite(Number(t.x))&&Number.isFinite(Number(t.y))&&t.x!==null&&t.y!==null&&t.x!==''&&t.y!==''}
function extractItems(data){if(Array.isArray(data))return data;if(Array.isArray(data.items))return data.items;if(Array.isArray(data.targets))return data.targets;if(Array.isArray(data.results))return data.results;if(data.result&&Array.isArray(data.result.items))return data.result.items;return data.x!==undefined?[data]:[]}
function normTarget(v,defKind='task'){
 const coord=v.coordinates||v.coordinate||v.position||v.location||{};
 const zone=v.warzone??v.serverId??v.warzoneId??coord.warzone??coord.serverId??2079;
 const x=v.x??v.mapX??v.coordX??coord.x??coord.mapX??null;
 const y=v.y??v.mapY??v.coordY??coord.y??coord.mapY??null;
 const reward=typeof v.reward==='string'?v.reward:typeof v.item==='string'?v.item:typeof v.items?.[0]==='string'?v.items[0]:v.itemName||v.rewardName||'';
 return {id:String(v.id??v.uid??`${zone}:${x}:${y}:${v.name??''}`),name:String(v.name??v.commanderName??v.targetName??v.title??v.taskName??'Target'),alliance:String(v.alliance??v.allianceTag??v.tag??''),warzone:Number(zone),x:x===null?null:Number(x),y:y===null?null:Number(y),reward:String(reward),amount:String(v.amount??v.quantity??''),kind:defKind,raw:v};
}
async function findTasks(){
 if(ui.mode==='demo'){
  ui.taskResults=DEMO_TASKS.filter(t=>(ui.reward==='all'||t.reward===ui.reward)&& (ui.scope==='auto'||parseZones($('task-zones').value,3).includes(t.warzone)));
  renderTasks();notify('DEMO ONLY: The displayed coordinates and rewards are invented examples.');return;
 }
 if(!ui.account){notify('Live mission scans need an API token and credits configured on the server.','warning');return}
 let zoneArr=null;
 try{if(ui.scope==='custom')zoneArr=parseZones($('task-zones').value,3)}catch(e){notify(e.message,'error');return}
 const choices=getRewardOptions();const supported=choices.some(r=>r.value===ui.reward);
 const rewardCode=ui.reward!=='all'&&supported?ui.reward:'';
 const actualDesc=rewardCode?`reward “${ui.reward}”`:'all reward types';
 const scopeText=zoneArr?`warzone(s) ${zoneArr.join(', ')}`:'warzones selected by the provider';
 showModal({title:'Confirm charged task scan',description:`Find secret tasks for ${actualDesc} across ${scopeText}. This spends real lastintel credits.`,extra:`<div class="sensitive"><b>${esc(scanQuote('secret_task',zoneArr?.join(',')||''))}</b><br>Balance: ${esc(ui.account.credits)} credits. Result availability and charges depend on the provider.</div>`,button:'Run paid task scan',onConfirm:async()=>{
  const data=await api('secret',{confirmed:true,warzones:zoneArr||'',rewardCode});
  ui.taskResults=extractItems(data).map(v=>normTarget(v,'task'));
  ui.liveMap=[...ui.taskResults.filter(validXY),...ui.liveMap.filter(v=>v.kind!=='task')];
  renderTasks();updateMapZones();await checkConnection();
  if(!ui.taskResults.length)notify('Provider returned no mission rows. This does not imply a full warzone scan was returned.','warning');
 }});
}
function renderTasks(){
 const el=$('task-results'),items=ui.taskResults;$('task-count').textContent=items.length+' targets';
 if(!items.length){el.className='result-list empty-state';el.innerHTML='<div class="empty-icon">✧</div><p>No mission results. Run a search.</p>';return}
 el.className='result-list';
 el.innerHTML=items.map((t,i)=>`<div class="target-row"><div><div class="row-title">${esc(t.name||'Mission')} ${ui.mode==='demo'?'<span class="target-badge">DEMO</span>':''}</div><div class="target-meta"><span>${esc(t.alliance?'['+t.alliance+']':'')}</span><span>Warzone #${esc(t.warzone??'?')}</span><span>${validXY(t)?'X '+esc(t.x)+' · Y '+esc(t.y):'Coordinate unavailable'}</span></div><p class="reward-info">✧ ${esc(t.reward||'Reward not specified')} ${esc(t.amount||'')}</p><div class="target-actions"><button class="smallbtn" data-copy-task="${i}" ${validXY(t)?'':'disabled'}>Copy coords</button><button class="smallbtn orange" data-send-task="${i}" ${validXY(t)&&ui.mode==='live'?'':'disabled'}>Send in-game</button></div></div><span class="target-badge">TASK</span></div>`).join('');
 el.querySelectorAll('[data-copy-task]').forEach(b=>b.onclick=()=>copyCoords(items[Number(b.dataset.copyTask)]));
 el.querySelectorAll('[data-send-task]').forEach(b=>b.onclick=()=>sendCoords(items[Number(b.dataset.sendTask)]));
}
async function copyText(value){try{await navigator.clipboard.writeText(value);notify('Coordinates copied.')}catch{
  const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();notify('Coordinates copied.')}}
function copyCoords(t){if(!validXY(t))return notify('No coordinate available.','warning');copyText(`#${t.warzone} X:${t.x} Y:${t.y} ${t.name||''}`)}
async function sendCoords(t){
 if(!validXY(t)||ui.mode!=='live')return;
 if(!ui.tokenConfigured){notify('Connect your lastintel API token first.','warning');return}
 let verified;try{verified=await api('verified')}catch(e){notify('Cannot load verified game accounts: '+e.message,'error');return}
 const opts=verified.items||[];if(!opts.length){notify('Verify your game commander inside lastintel before sending coordinates.','warning');return}
 const select=`<label>Verified game commander<select id="send-uid">${opts.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label><div class="sensitive">#${esc(t.warzone)} · <b>X ${esc(t.x)} · Y ${esc(t.y)}</b><br>This creates a real in-game private message and may spend provider credits. The send cannot be undone.</div>`;
 showModal({title:'Send in-game coordinate',description:`Send ${t.name} to your own verified game account?`,extra:select,button:'Send message',onConfirm:async()=>{
  const uid=$('send-uid').value;const result=await api('send',{targetUid:uid,warzone:t.warzone,x:t.x,y:t.y,label:t.name,confirmed:true});
  notify(result.delivered?'Coordinate sent to verified in-game messages.':'Provider returned a send response. Check your game inbox.');
 }});
}
function renderMap(){updateMapZones()}
function renderSaved(){
 $('saved-count').textContent=ui.saved.length+' saved';$('nav-count').textContent=ui.saved.length;
 const q=$('saved-filter').value.toLowerCase().trim();const items=ui.saved.map((x,i)=>({...x,originalIndex:i})).filter(t=>!q||`${t.name} ${t.alliance} ${t.warzone} ${t.x} ${t.y}`.toLowerCase().includes(q));
 $('saved-list').innerHTML=items.length?items.map(t=>`<div class="saved-card"><div><h4>${esc(t.name)}</h4><p>${esc(t.alliance||'Local entry')} · #${esc(t.warzone)} · X ${esc(t.x)} · Y ${esc(t.y)} · ${esc(t.kind)}</p>${t.notes?`<p>${esc(t.notes)}</p>`:''}</div><div class="saved-actions"><button class="smallbtn" data-savecopy="${t.originalIndex}">Copy</button><button class="smallbtn" data-saveview="${t.originalIndex}">Map</button><button class="smallbtn orange" data-savedel="${t.originalIndex}">Delete</button></div></div>`).join(''):'<div class="empty-state"><div class="empty-icon">⚑</div><p>No local targets. Add coordinates from the map or import your CSV.</p></div>';
 $('saved-list').querySelectorAll('[data-savecopy]').forEach(b=>b.onclick=()=>copyCoords(ui.saved[+b.dataset.savecopy]));
 $('saved-list').querySelectorAll('[data-saveview]').forEach(b=>b.onclick=()=>{const t=ui.saved[+b.dataset.saveview];go('map');$('map-zone-filter').value=String(t.warzone);ui.map.centerX=t.x;ui.map.centerY=t.y;ui.map.zoom=2;ui.map.hover=t;drawMap()});
 $('saved-list').querySelectorAll('[data-savedel]').forEach(b=>b.onclick=()=>{ui.saved.splice(+b.dataset.savedel,1);saveLocal()});
}
function csvParse(text){
 const result=[],rows=[];let row=[],cell='',quoted=false;const input=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  let c=input[i];if(quoted){if(c==='"'&&input[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c;continue}
  if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=c;
 }
 if(quoted)throw Error('CSV has an unclosed quote.');if(cell||row.length){row.push(cell);rows.push(row)}
 const head=(rows.shift()||[]).map(s=>s.trim().toLowerCase());
 if(!['name','x','y','warzone'].every(h=>head.includes(h)))throw Error('CSV must include name, warzone, x and y header columns.');
 for(const r of rows){const obj=Object.fromEntries(head.map((k,i)=>[k,(r[i]||'').trim()]));if(!obj.name)continue;
  const t={id:`local-${Date.now()}-${result.length}`,name:obj.name,alliance:obj.alliance||'',warzone:Number(obj.warzone),x:Number(obj.x),y:Number(obj.y),kind:['base','task','friendly','other'].includes(obj.kind)?obj.kind:'other',reward:obj.reward||'',notes:obj.notes||''};
  if(!validLocal(t))throw Error('Invalid coordinate row for '+obj.name);
  result.push(t);
 }
 return result;
}
function validLocal(t){return Number.isSafeInteger(t.warzone)&&t.warzone>=1&&t.warzone<=100000&&Number.isFinite(t.x)&&t.x>=0&&t.x<=10000&&Number.isFinite(t.y)&&t.y>=0&&t.y<=10000}
async function importCsv(event){
 const file=event.target.files?.[0];if(!file)return;
 try{if(file.size>1000000)throw Error('File must be under 1 MB');const items=csvParse(await file.text());if(ui.saved.length+items.length>5000)throw Error('Maximum 5,000 local targets supported.');
 ui.saved.push(...items);saveLocal();$('import-status').textContent=`Imported ${items.length} local target(s).`;
 notify(`Imported ${items.length} targets from your CSV. No data was sent to any server.`);
 }catch(e){$('import-status').textContent=e.message;notify('Import failed: '+e.message,'error')}
 event.target.value='';
}
function downloadFile(filename,body){const blob=new Blob([body],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function addManual(e){e.preventDefault();const obj={id:`local-${Date.now()}`,name:$('manual-name').value.trim(),alliance:'',warzone:Number($('manual-zone').value),x:Number($('manual-x').value),y:Number($('manual-y').value),kind:$('manual-kind').value,reward:'',notes:''};
 if(!obj.name||!validLocal(obj)){notify('Enter a name and valid coordinates.','error');return}
 ui.saved.push(obj);saveLocal();e.target.reset();$('manual-zone').value='2079';notify(`Saved ${obj.name} as a local target.`);
}
function mapPoints(){const src=[...ui.saved,...(ui.mode==='demo'?[...DEMO_TASKS,...DEMO_COMMANDERS.map(c=>({id:c.id,name:c.name,alliance:c.tag,warzone:c.serverId,x:c.x,y:c.y,kind:'base'}))]:ui.liveMap)];return src.filter(x=>Number(x.warzone)===Number($('map-zone-filter').value)&&validXY(x))}
function updateMapZones(){
 const el=$('map-zone-filter');const before=el.value||'2079';const zones=new Set([2079]);[...ui.saved,...DEMO_TASKS,...DEMO_COMMANDERS.map(c=>({warzone:c.serverId})),...ui.liveMap].forEach(v=>zones.add(Number(v.warzone)));
 el.innerHTML=[...zones].sort((a,b)=>a-b).map(v=>`<option value="${v}">#${v}</option>`).join('');el.value=[...zones].includes(Number(before))?before:'2079';drawMap();
}
function drawMap(){
 const canvas=$('map-canvas');const host=canvas.parentElement;const width=Math.round(host.clientWidth),height=Math.round(host.clientHeight);if(width<1||height<1)return;
 const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 ctx.fillStyle='#0c1b2a';ctx.fillRect(0,0,width,height);
 const pts=mapPoints();const extent=Math.max(1000,...pts.map(p=>Math.max(p.x,p.y)+100));ui.map.extent=extent;
 const scale=Math.min((width-50)/extent,(height-50)/extent)*ui.map.zoom;ui.map.scale=scale;
 const project=(x,y)=>({px:width/2+(x-ui.map.centerX)*scale,py:height/2+(y-ui.map.centerY)*scale});ui.map.project=project;
 ctx.lineWidth=1;ctx.font='10px system-ui';
 const step=ui.map.zoom>=2?50:100;
 for(let val=0;val<=extent;val+=step){const ax=project(val,0).px,ay=project(0,val).py;
  ctx.strokeStyle=val%200===0?'#34506877':'#243b5050';
  if(ax>=0&&ax<=width){ctx.beginPath();ctx.moveTo(ax,0);ctx.lineTo(ax,height);ctx.stroke();if(val%200===0){ctx.fillStyle='#607f99';ctx.fillText(val,ax+3,13)}}
  if(ay>=0&&ay<=height){ctx.beginPath();ctx.moveTo(0,ay);ctx.lineTo(width,ay);ctx.stroke();if(val%200===0){ctx.fillStyle='#607f99';ctx.fillText(val,5,ay-4)}}
 }
 const colors={task:'#f4b150',base:'#f17777',friendly:'#61e5ad',other:'#6cc3ec'};
 for(const p of pts){const pos=project(p.x,p.y);if(pos.px<0||pos.px>width||pos.py<0||pos.py>height)continue;
  const active=ui.map.hover&&p.id===ui.map.hover.id;ctx.beginPath();ctx.arc(pos.px,pos.py,active?9:5.4,0,Math.PI*2);ctx.fillStyle=colors[p.kind]||colors.other;ctx.fill();ctx.strokeStyle='#07101b';ctx.lineWidth=2;ctx.stroke();
  if(active){ctx.beginPath();ctx.arc(pos.px,pos.py,14,0,Math.PI*2);ctx.strokeStyle='#ffda9c';ctx.stroke()}
 }
 $('map-points').textContent=pts.length+' mapped locations';$('map-zone-name').textContent='#'+$('map-zone-filter').value+' / TLW FIELD MAP';
}
function mapTap(e){
 const c=$('map-canvas'),rect=c.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 let best=null,dist=16;
 for(const p of mapPoints()){const pos=ui.map.project(p.x,p.y);const d=Math.hypot(pos.px-x,pos.py-y);if(d<dist){dist=d;best=p}}
 if(best){ui.map.hover=best;$('map-selected').innerHTML=`<b>${esc(best.name)}</b> · #${esc(best.warzone)} · X ${esc(best.x)} Y ${esc(best.y)} · ${esc(best.kind)} <button class="smallbtn" id="map-copy">Copy</button>`;$('map-copy').onclick=()=>copyCoords(best)}else{ui.map.hover=null;$('map-selected').textContent='No target selected. Pan or zoom to explore.'}drawMap();
}
function mapMoveStart(e){const c=$('map-canvas');c.setPointerCapture(e.pointerId);ui.map.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false}}
function mapMove(e){const d=ui.map.drag;if(!d)return;const dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;if(Math.abs(e.clientX-d.x)>4||Math.abs(e.clientY-d.y)>4)d.moved=true;
 if(d.moved){ui.map.centerX-=dx/(ui.map.scale||1);ui.map.centerY-=dy/(ui.map.scale||1);drawMap()}d.lastX=e.clientX;d.lastY=e.clientY}
function mapMoveEnd(e){const d=ui.map.drag;if(!d)return;ui.map.drag=null;if(!d.moved)mapTap(e)}
function zoom(factor){ui.map.zoom=Math.max(.6,Math.min(6,ui.map.zoom*factor));drawMap()}
async function openSettings(){
 const connected=ui.tokenConfigured?'API token is configured on the server.':'No server-side API token is configured.';
 const html=`<div class="sensitive">${esc(connected)}<br>Never paste your lastintel API token into this browser. Configure it privately in your server environment. Game passwords are never needed.</div><label style="margin-top:14px">Optional TLW private access code<input id="settings-access" style="display:block;width:100%;padding:12px;margin-top:7px;background:#0e1724;color:white;border:1px solid #4a6075;border-radius:8px" type="password" placeholder="Leave blank if access protection is disabled" value="${esc(sessionStorage.getItem('tlw-access-code')||'')}"></label><p class="helper">Access code is kept only for this browser tab session. It is not the lastintel token.</p>`;
 showModal({title:'TLW Intel settings',description:'Server #2079 · The Lost Warriors. This is a private operator tool, not an alliance-wide synchronized database.',extra:html,button:'Save settings',onConfirm:async()=>{sessionStorage.setItem('tlw-access-code',$('settings-access').value.trim());await checkConnection()}});
}
function init(){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
 $('toggle-mode').onclick=switchMode;$('settings-open').onclick=openSettings;
 $('search-form').onsubmit=doSearch;$('locate-button').onclick=locate;
 document.querySelectorAll('input[name="scope"]').forEach(b=>b.onchange=()=>setScope(b.value));$('task-zones').oninput=updateCost;
 $('find-tasks').onclick=()=>{try{if(ui.mode==='demo'&&ui.scope==='custom')parseZones($('task-zones').value,3);findTasks()}catch(e){notify(e.message,'error')}};
 $('manual-form').onsubmit=addManual;$('csv-import').onchange=importCsv;
 $('csv-template').onclick=()=>downloadFile('tlw-intel-coordinate-template.csv','name,alliance,warzone,x,y,kind,reward,notes\n');
 $('saved-filter').oninput=renderSaved;$('clear-saved').onclick=()=>{
  if(!ui.saved.length)return;
  showModal({title:'Delete local targets?',description:`Permanently erase ${ui.saved.length} target(s) saved in this browser. This cannot be undone.`,button:'Delete all local targets',onConfirm:()=>{ui.saved=[];saveLocal();notify('All local targets deleted.')}});
 };
 $('modal-close').onclick=hideModal;$('modal-cancel').onclick=hideModal;
 $('modal-root').onclick=e=>{if(e.target===$('modal-root'))hideModal()};
 $('modal-ok').onclick=async()=>{const fn=ui.modalAction;if(!fn)return;const btn=$('modal-ok');btn.disabled=true;const prev=btn.textContent;btn.textContent='Working…';try{await fn();hideModal()}catch(e){$('modal-text').textContent='Operation failed: '+e.message;notify(e.message,'error')}finally{btn.disabled=false;btn.textContent=prev}};
 $('zoom-out').onclick=()=>zoom(.75);$('zoom-in').onclick=()=>zoom(1.4);
 $('zoom-reset').onclick=()=>{ui.map.zoom=1;ui.map.centerX=500;ui.map.centerY=500;drawMap()};
 $('map-zone-filter').onchange=()=>{ui.map.zoom=1;ui.map.centerX=500;ui.map.centerY=500;drawMap()};
 const canvas=$('map-canvas');canvas.onpointerdown=mapMoveStart;canvas.onpointermove=mapMove;canvas.onpointerup=mapMoveEnd;canvas.onpointercancel=()=>ui.map.drag=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.15:.86)},{passive:false});
 window.addEventListener('resize',drawMap);
 renderRewards();renderSearch();renderSelected();renderTasks();renderSaved();refreshStats();updateMapZones();go('overview');
}
document.addEventListener('DOMContentLoaded',init);
