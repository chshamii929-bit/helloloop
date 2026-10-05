import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../server/index.mjs';
import { Matchmaker } from '../server/matching.mjs';

async function setup(t,options={}) {
 const base=resolve('.data');mkdirSync(base,{recursive:true});const dataDir=mkdtempSync(resolve(base,'test-'));
 const app=createApp({...options,dataDir});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await app.close();if(dataDir.startsWith(base+String.fromCharCode(92))||dataDir.startsWith(base+'/'))rmSync(dataDir,{recursive:true,force:true});});
 async function session(name,extra={},cookie) {
   const res=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({name,adult:true,...extra})});
   return {res,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 }
 async function client(name) {
   const s=await session(name,options.accessCode?{code:options.accessCode}:{});
   assert.equal(s.res.status,200);
   const socket=new WebSocket(origin.replace('http:','ws:')+'/ws',{origin,headers:{Cookie:s.cookie}});
   const inbox=[];const waiters=[];
   socket.on('message',raw=>{
     const value=JSON.parse(raw);const index=waiters.findIndex(w=>w.type===value.type);
     if(index>=0){const w=waiters.splice(index,1)[0];clearTimeout(w.timer);w.resolve(value);}else inbox.push(value);
   });
   socket.on('error',()=>{});
   function wait(type,ms=2000){
     const index=inbox.findIndex(m=>m.type===type);if(index>=0)return Promise.resolve(inbox.splice(index,1)[0]);
     return new Promise((resolve,reject)=>{const w={type,resolve,timer:setTimeout(()=>{const i=waiters.indexOf(w);if(i>=0)waiters.splice(i,1);reject(new Error('Timed out: '+type));},ms)};waiters.push(w);});
   }
   await wait('ready');
   return {socket,inbox,wait,id:s.data.id,cookie:s.cookie,send:(type,data={})=>socket.send(JSON.stringify({type,...data}))};
 }
 async function pair(a,b) {
   a.send('join',{interests:['Music']});await a.wait('waiting');
   b.send('join',{interests:['Music']});
   const [am,bm]=await Promise.all([a.wait('matched'),b.wait('matched')]);assert.equal(am.room,bm.room);return am.room;
 }
 return {...app,origin,session,client,pair};
}
test('requires adult confirmation, valid name, origin and staging code',async t=>{
 const a=await setup(t,{accessCode:'test-code'});
 assert.equal((await a.session('Ali',{adult:false,code:'test-code'})).res.status,400);
 assert.equal((await a.session('',{code:'test-code'})).res.status,400);
 assert.equal((await a.session('Ali')).res.status,401);
 assert.equal((await a.session('Ali',{code:'test-code'})).res.status,200);
 const res=await fetch(a.origin+'/api/session',{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'});assert.equal(res.status,403);
});
test('signed identity persists on returning session and rejects tampering',async t=>{
 const a=await setup(t);const first=await a.session('Ali');
 const again=await a.session('Ali renamed',{},first.cookie);assert.equal(first.data.id,again.data.id);
 const forged=await a.session('Intruder',{},first.cookie.slice(0,-1)+'Z');assert.notEqual(first.data.id,forged.data.id);
});
test('pairs exclusively, relays current-room signals and text, rejects stale rooms',async t=>{
 const a=await setup(t);const ali=await a.client('Ali'),sara=await a.client('Sara'),omar=await a.client('Omar');
 const room=await a.pair(ali,sara);
 omar.send('join');await omar.wait('waiting');assert.equal(a.matchmaker.queue.size,1);
 ali.send('signal',{room,signal:{kind:'offer',description:{type:'offer',sdp:'test'}}});
 assert.equal((await sara.wait('signal')).room,room);
 ali.send('chat',{room,text:'Hello Sara'});assert.equal((await sara.wait('chat')).text,'Hello Sara');await ali.wait('chat');
 ali.send('chat',{room:'wrong',text:'must not arrive'});
 ali.send('chat',{room,text:'after stale'});assert.equal((await sara.wait('chat')).text,'after stale');
 assert.equal(sara.inbox.filter(m=>m.type==='chat').length,0);
});
test('Next releases prior partner and finds an eligible waiting user',async t=>{
 const a=await setup(t);const ali=await a.client('Ali'),sara=await a.client('Sara'),omar=await a.client('Omar');
 await a.pair(ali,sara);omar.send('join');await omar.wait('waiting');
 ali.send('join');const [match]=await Promise.all([ali.wait('matched'),omar.wait('matched'),sara.wait('peer-left')]);
 assert.equal(match.peer.id,omar.id);assert.equal(a.matchmaker.clients.get(sara.id).room,null);
});
test('both users must request friendship; friend invites are consent-based',async t=>{
 const a=await setup(t);const ali=await a.client('Ali'),sara=await a.client('Sara');const room=await a.pair(ali,sara);
 ali.send('friend-request',{room});await sara.wait('friend-request');assert.equal(a.store.friends(ali.id).length,0);
 sara.send('friend-request',{room});await ali.wait('friend-added');assert.equal(a.store.friends(ali.id)[0].id,sara.id);
 ali.send('stop');await ali.wait('stopped');await sara.wait('peer-left');
 ali.send('invite',{target:sara.id});const invite=await sara.wait('invitation');assert.equal(a.matchmaker.clients.get(ali.id).room,null);
 sara.send('accept-invite',{key:invite.key});await Promise.all([ali.wait('matched'),sara.wait('matched')]);
});
test('expired invitation gives a recoverable error',async t=>{
 const a=await setup(t);const ali=await a.client('Ali');
 ali.send('accept-invite',{key:'expired'});assert.match((await ali.wait('invite-failed')).message,/expired/);
});
test('report persists and blocks future matching and removes friendship',async t=>{
 const a=await setup(t);const ali=await a.client('Ali'),sara=await a.client('Sara');const room=await a.pair(ali,sara);
 a.store.addFriend(ali.id,sara.id);
 ali.send('report',{room,reason:'Harassment'});await ali.wait('blocked');await sara.wait('peer-left');
 assert.equal(a.store.reports().length,1);assert.equal(a.store.reports()[0].reason,'Harassment');
 assert.equal(a.store.blocked(ali.id,sara.id),true);assert.equal(a.store.friends(ali.id).length,0);
 // Remove recent-match exclusions to ensure persistent blocking is the reason.
 a.matchmaker.clients.get(ali.id).last=null;a.matchmaker.clients.get(sara.id).last=null;
 ali.send('join');await ali.wait('waiting');sara.send('join');await sara.wait('waiting');assert.equal(a.matchmaker.queue.size,2);
});
test('disconnect cleans queue and informs the remaining peer',async t=>{
 const a=await setup(t);const ali=await a.client('Ali'),sara=await a.client('Sara');await a.pair(ali,sara);
 ali.socket.close();await sara.wait('peer-left');assert.equal(a.matchmaker.clients.has(ali.id),false);
 sara.send('join');await sara.wait('waiting');sara.socket.close();await new Promise(r=>setTimeout(r,30));assert.equal(a.matchmaker.queue.size,0);
});
test('untrusted WebSocket origin and unsigned identity are rejected',async t=>{
 const a=await setup(t);const s=await a.session('Ali');
 for(const [origin,cookie] of [['https://evil.example',s.cookie],[a.origin,'chitchat=forged']]){
   await new Promise((resolve,reject)=>{
     const ws=new WebSocket(a.origin.replace('http:','ws:')+'/ws',{origin,headers:{Cookie:cookie}});
     ws.on('unexpected-response',(_,res)=>{assert.equal(res.statusCode,403);res.resume();ws.terminate();resolve();});
     ws.on('error',()=>{});ws.on('open',()=>{ws.close();reject(new Error('Unexpected authorization'));});
   });
 }
});
test('action flood gets throttled',async t=>{
 const a=await setup(t);const ali=await a.client('Ali');
 for(let i=0;i<45;i++)ali.send('stop');
 assert.match((await ali.wait('error')).message,/slow down/);
});
test('100 simultaneous logical users create 50 unique rooms with no duplicates',()=>{
 const sent=new Map();
 const store={blocked:()=>false,user:id=>({id,name:id}),friends:()=>[],friend:()=>false};
 const match=new Matchmaker(store);
 for(let i=0;i<100;i++){
   const id='u'+i;sent.set(id,[]);
   const c=match.add(id,{readyState:1,send:s=>sent.get(id).push(JSON.parse(s)),close(){}});
   match.join(c,['Music']);
 }
 const rooms=new Map();
 for(const c of match.clients.values()){assert.ok(c.room);rooms.set(c.room,(rooms.get(c.room)||0)+1);}
 assert.equal(rooms.size,50);assert.ok([...rooms.values()].every(count=>count===2));assert.equal(match.queue.size,0);
});


test('relay-only configuration requires TURN and is supplied to tester sessions',async t=>{
 const keys=['ICE_TRANSPORT_POLICY','TURN_URLS','TURN_USERNAME','TURN_CREDENTIAL'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 t.after(()=>{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
 process.env.ICE_TRANSPORT_POLICY='relay';
 for(const key of keys.slice(1))delete process.env[key];
 assert.throws(()=>createApp(),/requires all TURN/);
 process.env.TURN_URLS='turn:relay.invalid:3478';
 process.env.TURN_USERNAME='test-user';process.env.TURN_CREDENTIAL='test-only';
 const app=await setup(t);const result=await app.session('Relay tester');
 assert.equal(result.data.iceTransportPolicy,'relay');assert.equal(result.data.relayConfigured,true);
 assert.equal(result.data.iceServers[1].urls[0],'turn:relay.invalid:3478');
});

