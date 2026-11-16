import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWarzones, handleAction } from '../lib/intel.js';
test('warzone parsing deduplicates numeric IDs',()=> assert.deepEqual(parseWarzones('2079, 2064;2079'),[2079,2064]));
test('invalid and excessive scopes rejected',()=> {
  assert.throws(()=>parseWarzones('foo'));
  assert.throws(()=>parseWarzones(Array.from({length:11},(_,i)=>i+1)));
});
test('paid scans require explicit consent',async()=> {
  await assert.rejects(handleAction({action:'secret'},''),/Confirm/);
  await assert.rejects(handleAction({action:'locate',commanderId:'uid_test',warzones:'2079'},''),/Confirm/);
  await assert.rejects(handleAction({action:'send',targetUid:'12345678901',warzone:2079,x:10,y:10},''),/confirmation/);
});
test('health does not reveal server credentials',async()=> {
  const x=await handleAction({action:'health'},'');
  assert.equal(x.server,2079); assert.equal(typeof x.tokenConfigured,'boolean');
  assert.equal(x.token,undefined);
});
