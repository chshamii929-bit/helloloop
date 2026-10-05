import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createApp} from '../server/index.mjs';
if(!existsSync('out/index.html'))throw new Error('Run npm run build first.');
mkdirSync('.data',{recursive:true});
const codeFile=resolve('.data/remote-test-code');
if(!existsSync(codeFile))writeFileSync(codeFile,randomBytes(18).toString('base64url'),{mode:0o600});
process.env.STAGING_ACCESS_CODE=readFileSync(codeFile,'utf8').trim();
delete process.env.PUBLIC_ORIGIN;
process.env.TRUST_CLOUDFLARE_PROXY="true";
const port=Number(process.env.REMOTE_TEST_PORT||3001);
let app;let stopping=false;let buffer='';
const tunnel=spawn(resolve('.sites-runtime/tools/cloudflared.exe'),['tunnel','--url','http://127.0.0.1:'+port,'--protocol','http2','--no-autoupdate'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
const deadline=setTimeout(()=>{console.error('Tunnel startup timed out.');void stop(1);},60000);
async function stop(code=0){if(stopping)return;stopping=true;clearTimeout(deadline);tunnel.kill();if(app)await app.close();process.exitCode=code;}
function output(chunk){
 buffer=(buffer+chunk.toString()).slice(-12000);if(app)return;
 const match=buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(!match||match[0]==='https://api.trycloudflare.com')return;
 process.env.PUBLIC_ORIGIN=match[0];app=createApp();
 app.server.on('error',err=>{console.error(err.message);void stop(1);});
 app.server.listen(port,'127.0.0.1',()=>{
 clearTimeout(deadline);writeFileSync('.data/remote-test-url',match[0]);
 console.log('REMOTE TEST URL: '+match[0]);console.log('TESTER CODE: '+process.env.STAGING_ACCESS_CODE);
 console.log('Keep PC and this process running. Ctrl+C ends remote testing.');
 console.log('TURN configured: '+Boolean(process.env.TURN_URLS&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL));
 });
}
tunnel.stdout.on('data',output);tunnel.stderr.on('data',output);
tunnel.on('error',err=>{console.error(err.message);void stop(1);});
tunnel.on('exit',code=>{if(!stopping){console.error('Tunnel ended: '+code);void stop(1);}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());

