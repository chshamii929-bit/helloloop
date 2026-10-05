import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createStore } from './store.mjs';
import { Matchmaker } from './matching.mjs';

export function createApp(options={}) {
  if(process.env.NODE_ENV==='production'&&(!process.env.SESSION_SECRET||!process.env.STAGING_ACCESS_CODE||!process.env.PUBLIC_ORIGIN))throw new Error('Staging requires SESSION_SECRET, STAGING_ACCESS_CODE and PUBLIC_ORIGIN.');
  const relayOnly=process.env.ICE_TRANSPORT_POLICY==='relay';
  if(relayOnly&&(!process.env.TURN_URLS||!process.env.TURN_USERNAME||!process.env.TURN_CREDENTIAL))throw new Error('Relay-only testing requires all TURN settings.');
  const dataDir=options.dataDir||process.env.DATA_DIR||resolve('.data');
  mkdirSync(dataDir,{recursive:true});
  let secret=process.env.SESSION_SECRET;
  if(!secret){
    const path=resolve(dataDir,'session-secret');
    if(!existsSync(path))writeFileSync(path,randomBytes(32).toString('hex'),{mode:0o600});
    secret=readFileSync(path,'utf8');
  }
  const store=createStore(resolve(dataDir,'chitchat.sqlite'));
  const matchmaker=new Matchmaker(store);
  const root=resolve(options.root||'out');
  const limits=new Map();
  const accessCode=options.accessCode??process.env.STAGING_ACCESS_CODE;
  const secure=process.env.PUBLIC_ORIGIN?.startsWith('https://');
  function allowed(req){
    const origin=req.headers.origin;
    const expected=process.env.PUBLIC_ORIGIN||'http://'+req.headers.host;
    return origin===expected;
  }
  function identity(req) {
    const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('chitchat='))?.slice(9);
    if(!value)return null;const [id,signature]=value.split('.');
    if(!id||!signature)return null;
    const correct=createHmac('sha256',secret).update(id).digest('hex');
    if(signature.length!==correct.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(correct)))return null;
    return store.user(id)?id:null;
  }
  function json(res,status,data,headers={}) {
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'){json(res,200,{ok:true});return;}
    if(url.pathname==='/api/session'&&req.method==='POST'){
      if(!allowed(req)){json(res,403,{error:'Origin not allowed'});return;}
      const ip=req.socket.remoteAddress;const entry=limits.get(ip)||{count:0,time:Date.now()};
      if(Date.now()-entry.time>60000){entry.count=0;entry.time=Date.now();}entry.count++;limits.set(ip,entry);
      if(entry.count>30){json(res,429,{error:'Too many attempts. Try again in a minute.'});return;}
      let body='';
      try {
        for await(const chunk of req){body+=chunk;if(body.length>4096){json(res,413,{error:'Request too large'});return;}}
        const input=JSON.parse(body);
        if(accessCode&&input.code!==accessCode){json(res,401,{error:'Enter the correct staging access code.'});return;}
        if(input.adult!==true){json(res,400,{error:'You must confirm you are 18 or older.'});return;}
        const name=typeof input.name==='string'?input.name.trim().slice(0,24):'';
        if(!name){json(res,400,{error:'Choose a display name.'});return;}
        const id=identity(req)||randomUUID();store.saveUser(id,name);
        const signature=createHmac('sha256',secret).update(id).digest('hex');
        const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
        if(process.env.TURN_URLS&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL)
          iceServers.push({urls:process.env.TURN_URLS.split(','),username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL});
        json(res,200,{id,name,iceServers,relayConfigured:iceServers.length>1,iceTransportPolicy:relayOnly?'relay':'all'},{'Set-Cookie':`chitchat=${id}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?'; Secure':''}`});
      }catch{json(res,400,{error:'Invalid request'});}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return;}
    if(url.pathname.startsWith('/api/')){json(res,404,{error:'Not found'});return;}
    let path;
    try{path=resolve(root,'.'+decodeURIComponent(url.pathname));}catch{json(res,400,{error:'Invalid path'});return;}
    if(path!==root&&!path.startsWith(root+sep)){json(res,403,{error:'Forbidden'});return;}
    if(path===root||existsSync(path)&&statSync(path).isDirectory())path=resolve(path,'index.html');
    if(!existsSync(path)||!statSync(path).isFile()){json(res,404,{error:'Not found'});return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain'};
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');
    res.setHeader('Cache-Control',url.pathname.startsWith('/_next/static/')?'public,max-age=31536000,immutable':'no-cache');
    if(req.method==='HEAD'){res.end();return;}createReadStream(path).pipe(res);
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:24576});
  server.on('upgrade',(req,socket,head)=>{
    const id=identity(req);
    if(req.url!=='/ws'||!allowed(req)||!id){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
    if(matchmaker.clients.size>=Number(process.env.MAX_CONNECTIONS||100)&&!matchmaker.clients.has(id)){
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req,id));
  });
  wss.on('connection',(ws,req,id)=>{
    const c=matchmaker.add(id,ws);ws.alive=true;
    ws.on('pong',()=>{ws.alive=true;});
    ws.on('message',data=>{try{matchmaker.handle(c,JSON.parse(data.toString()));}catch{matchmaker.send(c,'error',{message:'Unable to complete that action.'});}});
    ws.on('close',()=>matchmaker.remove(c));ws.on('error',()=>matchmaker.remove(c));
  });
  const timer=setInterval(()=>{
    for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
    const now=Date.now();
    for(const [ip,v]of limits)if(now-v.time>60000)limits.delete(ip);
    for(const [key,v]of matchmaker.invites)if(v.expires<now)matchmaker.invites.delete(key);
  },15000);timer.unref();
  return {server,store,matchmaker,async close(){clearInterval(timer);for(const ws of wss.clients)ws.terminate();await new Promise(r=>server.close(r));await new Promise(r=>wss.close(r));store.close();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const app=createApp();const port=Number(process.env.PORT||3000);
  app.server.listen(port,'0.0.0.0',()=>console.log('ChitChat ready at http://localhost:'+port));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}


