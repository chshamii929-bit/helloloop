import { existsSync } from 'node:fs';
const hosted=process.argv.includes('--hosted');let failures=0;
function check(label,ok,note){console.log((ok?'PASS':'MISSING')+' '+label+(note?' — '+note:''));if(!ok)failures++;}
check('Node.js 24+',Number(process.versions.node.split('.')[0])>=24);
check('Built frontend',existsSync('out/index.html'),'Run npm run build if missing.');
check('Installed WebSocket dependency',existsSync('node_modules/ws/package.json'));
const keys=['TURN_URLS','TURN_USERNAME','TURN_CREDENTIAL'];
const relay=keys.every(k=>!!process.env[k]?.trim());
const partial=keys.some(k=>!!process.env[k]?.trim())&&!relay;
check('TURN settings are complete or all unset',!partial);
if(relay){
 const urls=process.env.TURN_URLS.split(',').map(x=>x.trim());
 check('TURN URLs use turn: or turns:',urls.every(x=>/^turns?:[^\s]+$/.test(x)));
 console.log('INFO TURN credentials are configured; a relay-only call still needs to be tested.');
}else console.log('LIMIT No TURN configured. Compatible direct calls can work; cross-network calls are not guaranteed.');
if(process.env.ICE_TRANSPORT_POLICY==='relay')check('Relay-only mode has credentials',relay);
if(hosted){
 let validOrigin=false;try{const url=new URL(process.env.PUBLIC_ORIGIN||'');validOrigin=url.protocol==='https:'&&url.origin===process.env.PUBLIC_ORIGIN;}catch{}
 check('Exact HTTPS PUBLIC_ORIGIN',validOrigin,'No trailing slash.');
 check('SESSION_SECRET',!!process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32,'Use at least 32 random characters.');
 check('Private STAGING_ACCESS_CODE',!!process.env.STAGING_ACCESS_CODE&&process.env.STAGING_ACCESS_CODE.length>=12,'Use at least 12 characters; share only with testers.');
 console.log('LIMIT Render Free storage is temporary. Use disposable test data.');
}
console.log(failures?'Fix the missing items before testing.':'Configuration checks passed. This does not prove video connectivity or hosting deployment.');
process.exitCode=failures?1:0;

