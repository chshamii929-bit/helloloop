import { randomUUID } from 'node:crypto';

export class Matchmaker {
  constructor(store) {
    this.store=store; this.clients=new Map(); this.queue=new Set(); this.invites=new Map();
  }
  send(c,type,data={}) { if(c?.ws.readyState===1) c.ws.send(JSON.stringify({type,...data})); }
  add(id,ws) {
    const old=this.clients.get(id); if(old) { this.remove(old); old.ws.close(4001,'Opened in another tab'); }
    const c={id,ws,room:null,peer:null,last:null,interests:[],requested:false,tokens:35,refill:Date.now()};
    this.clients.set(id,c); this.send(c,'ready',{id,online:this.clients.size}); this.refreshFriends(); return c;
  }
  refreshFriends() {
    for(const c of this.clients.values()) this.send(c,'friends',{friends:this.store.friends(c.id).map(f=>({...f,online:this.clients.has(f.id)}))});
  }
  detach(c,reason='left') {
    this.queue.delete(c.id);
    const p=this.clients.get(c.peer);
    if(p && p.peer===c.id) {
      p.last=c.id; p.room=null; p.peer=null; p.requested=false;
      this.send(p,'peer-left',{reason});
    }
    if(c.peer)c.last=c.peer;
    c.peer=null;c.room=null;c.requested=false;
    for(const [key,inv] of this.invites) if(inv.from===c.id||inv.to===c.id)this.invites.delete(key);
  }
  remove(c) {
    if(this.clients.get(c.id)!==c)return;
    this.detach(c);this.clients.delete(c.id);this.refreshFriends();
  }
  pair(a,b) {
    this.queue.delete(a.id);this.queue.delete(b.id);
    const room=randomUUID();a.room=b.room=room;a.peer=b.id;b.peer=a.id;
    a.requested=b.requested=false;
    for(const [c,p,initiator] of [[a,b,true],[b,a,false]])
      this.send(c,'matched',{room,initiator,peer:{...this.store.user(p.id),interests:p.interests},friends:this.store.friend(c.id,p.id)});
  }
  join(c,interests=[]) {
    this.detach(c);
    c.interests=Array.isArray(interests)? [...new Set(interests.filter(x=>typeof x==='string'&&x.length<=24))].slice(0,5):[];
    const candidates=[...this.queue].map(id=>this.clients.get(id)).filter(p=>p&&p!==c&&!p.room&&!this.store.blocked(c.id,p.id)&&c.last!==p.id&&p.last!==c.id);
    candidates.sort((a,b)=>Number(b.interests.some(x=>c.interests.includes(x)))-Number(a.interests.some(x=>c.interests.includes(x))));
    if(candidates.length)this.pair(c,candidates[0]);else {this.queue.add(c.id);this.send(c,'waiting');}
  }
  handle(c,m) {
    if(this.clients.get(c.id)!==c)return;
    const now=Date.now();c.tokens=Math.min(35,c.tokens+(now-c.refill)/200);c.refill=now;
    if(c.tokens<1){this.send(c,'error',{message:'Too many actions. Please slow down.'});return;} c.tokens--;
    if(!m||typeof m.type!=='string')return;
    if(m.type==='join'){this.join(c,m.interests);return;}
    if(m.type==='stop'){this.detach(c);this.send(c,'stopped');return;}
    if(m.type==='invite') {
      const target=this.clients.get(m.target);
      if(!target||target.room||this.queue.has(target.id)||c.room||!this.store.friend(c.id,target.id)||this.store.blocked(c.id,target.id)){
        this.send(c,'invite-failed',{message:'Your friend is unavailable right now.'});return;
      }
      this.detach(c);const key=randomUUID(); this.invites.set(key,{from:c.id,to:target.id,expires:now+30000});
      this.send(target,'invitation',{key,name:this.store.user(c.id).name});this.send(c,'notice',{message:'Invitation sent. It expires in 30 seconds.'});return;
    }
    if(m.type==='accept-invite'){
      const inv=this.invites.get(m.key);if(!inv||inv.to!==c.id||inv.expires<now){this.send(c,'invite-failed',{message:'This invitation has expired.'});return;}
      this.invites.delete(m.key);const p=this.clients.get(inv.from);
      if(!p||p.room||c.room||this.store.blocked(c.id,p.id)){this.send(c,'invite-failed',{message:'This invitation is no longer available.'});return;}
      this.pair(p,c);return;
    }
    const p=this.clients.get(c.peer);
    if(!c.room||m.room!==c.room||!p||p.room!==c.room)return;
    if(m.type==='signal') {
      const s=m.signal;
      if(s&&['offer','answer','candidate'].includes(s.kind)&&JSON.stringify(s).length<20000)
        this.send(p,'signal',{room:c.room,signal:s});
    } else if(m.type==='chat'&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=1000){
      const message={room:c.room,id:randomUUID(),text:m.text.trim(),from:c.id,time:now};this.send(p,'chat',message);this.send(c,'chat',message);
    } else if(m.type==='friend-request'){
      c.requested=true;
      if(p.requested){this.store.addFriend(c.id,p.id);this.send(c,'friend-added');this.send(p,'friend-added');this.refreshFriends();}
      else {this.send(p,'friend-request');this.send(c,'friend-sent');}
    } else if(m.type==='block'||m.type==='report'){
      if(m.type==='report'){
        const reasons=['Inappropriate content','Harassment','Spam or scam','Underage user','Other'];
        if(!reasons.includes(m.reason))return;
        this.store.report(randomUUID(),c.id,p.id,m.reason);
      }
      this.store.block(c.id,p.id);this.detach(c,'left');this.send(c,'blocked',{reported:m.type==='report'});this.refreshFriends();
    }
  }
}

