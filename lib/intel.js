const HOST = 'https://mcp.lastintel.io';
const PROTOCOL = '2025-06-18';

function assert(condition, message, status=400) {
  if (!condition) throw Object.assign(new Error(message), {status});
}

function parseWarzones(input, cap=10) {
  const values = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
  const result = [...new Set(values.filter(v => String(v).trim()).map(v => Number(v)))];
  assert(result.length > 0 && result.length <= cap && result.every(v => Number.isSafeInteger(v) && v >= 1 && v <= 100000), `Specify 1–${cap} valid warzone IDs.`);
  return result;
}

export { parseWarzones };

export async function callMcp(name, args = {}, options={}) {
  const token = (process.env.LASTINTEL_API_TOKEN || '').trim();
  if (options.tokenRequired) assert(token, 'Live scans require a lastintel API token configured on your server (.env / hosting environment).', 403);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL,
    'User-Agent': 'TLWIntel/1.0 (private alliance operator)'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(HOST, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'tools/call', params:{name, arguments:args} }),
      signal: AbortSignal.timeout(60000), cache:'no-store'
    });
  } catch(e) {
    throw Object.assign(new Error('Cannot reach lastintel MCP service. '+e.message),{status:502});
  }
  let raw = await response.text();
  let reply;
  try { reply = JSON.parse(raw); }
  catch { throw Object.assign(new Error('lastintel returned an unexpected response. Please retry later.'),{status:502}); }
  if (!response.ok || reply.error) {
    const e = reply.error || reply;
    throw Object.assign(new Error(e.message || e.reason || `lastintel HTTP ${response.status}`),{status:response.status || 502});
  }
  const result = reply.result || {};
  const data = result.structuredContent ?? result.content?.find(v=>v.type==='text')?.text ?? {};
  if (result.isError || data?.isError || data?.code && data?.nothingWasCharged !== undefined) {
    throw Object.assign(new Error(data.reason || data.message || `Provider refused: ${data.code || 'error'}`),{status:400});
  }
  return data;
}

const integer = (v, name, max=1073741824) => {
  const n=Number(v); assert(Number.isSafeInteger(n) && n >= 0 && n <= max,`Invalid ${name}`); return n;
};

export async function handleAction(payload, accessCode) {
  assert(payload && typeof payload==='object' && !Array.isArray(payload),'Invalid request');
  const action=String(payload.action || '');
  const code=process.env.TLW_ACCESS_CODE || '';
  if (code) assert(accessCode===code, 'This TLW dashboard requires its private access code.',401);
  if (process.env.VERCEL && !code && ['locate','secret','send'].includes(action)) {
    assert(false, 'For public hosting, configure TLW_ACCESS_CODE before enabling any paid action.', 403);
  }
  switch(action) {
    case 'health':
      return { tokenConfigured: Boolean(process.env.LASTINTEL_API_TOKEN), server:2079,
        dataProvider: 'lastintel.io', disclaimer:'Read-only browsing works without token. Live scans consume provider credits.' };
    case 'search': {
      const q=String(payload.query || '').trim();
      assert(q.length>=2 && q.length<=200,'Enter a commander or alliance name (2–200 characters).');
      const args={ query:q, limit:30 };
      if (String(payload.warzone || '').trim()) args.warzones=parseWarzones(payload.warzone,10);
      return await callMcp('search_commanders_and_alliances',args);
    }
    case 'account': {
      const account = await callMcp('get_account', {},{tokenRequired:true});
      const jobs = await callMcp('list_targeting_jobs', {},{tokenRequired:true});
      return { account, jobs:jobs.items||[] };
    }
    case 'locate': {
      assert(payload.confirmed === true,'Confirm the charged search before proceeding.');
      const commanderId=String(payload.commanderId || '').trim();
      assert(/^[\w:-]{2,120}$/.test(commanderId),'Please choose a commander from Search results first.');
      return await callMcp('run_targeting_job', {
        job:'locate', commanderId, warzones:parseWarzones(payload.warzones,10)
      },{tokenRequired:true});
    }
    case 'secret': {
      assert(payload.confirmed===true,'Confirm the charged secret-task search before proceeding.');
      const args={job:'secret_task'};
      if (payload.warzones && String(payload.warzones).trim()) args.warzones=parseWarzones(payload.warzones,3);
      if (payload.rewardCode) {
        const reward=String(payload.rewardCode).trim();
        assert(reward.length>=1 && reward.length<=120,'Invalid reward code.');
        // Only the provider's actual job schema can supply an accepted reward code.
        const list=await callMcp('list_targeting_jobs',{}, {tokenRequired:true});
        const secret=(list.items||[]).find(j=>j.type==='secret_task'||j.type==='secret');
        const itemOpt=(secret?.options||[]).find(o=>o.key==='items');
        const choices=itemOpt?.choices || itemOpt?.values || itemOpt?.enum || [];
        const valid=choices.some(c => typeof c==='string' ? c===reward : [c.value,c.id,c.key].includes(reward));
        assert(valid, 'This reward code is not offered by the provider. Select All rewards instead.');
        args.items=[reward];
      }
      return await callMcp('run_targeting_job',args,{tokenRequired:true});
    }
    case 'verified': return await callMcp('list_verified_game_accounts', {}, {tokenRequired:true});
    case 'send': {
      assert(payload.confirmed===true,'Sending game coordinates requires explicit confirmation.');
      const targetUid=String(payload.targetUid||'').trim();
      assert(/^\d{10,20}$/.test(targetUid),'Enter your verified 10–20 digit game UID.');
      const approved=await callMcp('list_verified_game_accounts', {},{tokenRequired:true});
      assert((approved.items || []).some(v=>String(v)===targetUid),'This UID is not verified on the connected lastintel account.',403);
      const args={ targetUid, warzone:integer(payload.warzone,'warzone'), x:integer(payload.x,'X'), y:integer(payload.y,'Y') };
      if (payload.label) args.label=String(payload.label).slice(0,72);
      return await callMcp('send_coordinates',args,{tokenRequired:true});
    }
    default: throw Object.assign(new Error('Unknown action.'),{status:404});
  }
}
