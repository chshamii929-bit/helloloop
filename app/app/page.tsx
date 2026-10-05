"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Video, VideoOff, Mic, MicOff, MessageCircle, Users, ShieldCheck, Sparkles, SkipForward, Square, Send, UserPlus, Flag, Ban, X, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useChitchat } from "@/hooks/use-chitchat";
const reasons=["Inappropriate content","Harassment","Spam or scam","Underage user","Other"];
function Feed({stream,muted=false,className=""}:{stream:MediaStream|null;muted?:boolean;className?:string}){
 const ref=useRef<HTMLVideoElement>(null);const [needsPlay,setNeedsPlay]=useState(false);
 useEffect(()=>{
   let disposed=false;setNeedsPlay(false);
   if(ref.current){ref.current.srcObject=stream;if(stream)void ref.current.play().catch(()=>{if(!disposed&&!muted)setNeedsPlay(true);});}
   return()=>{disposed=true;};
 },[stream,muted]);
 return <><video ref={ref} autoPlay playsInline muted={muted} className={className}/>{needsPlay&&stream&&<button className="play-media" onClick={()=>void ref.current?.play().then(()=>setNeedsPlay(false)).catch(()=>setNeedsPlay(true))}><Video size={17}/> Play video & audio</button>}</>;
}
export default function Home(){
 const chat=useChitchat();const [name,setName]=useState("");const [code,setCode]=useState("");const [adult,setAdult]=useState(false);
 const [draft,setDraft]=useState("");
 const [chatOpen,setChatOpen]=useState(false);const [readCount,setReadCount]=useState(0);const messageInput=useRef<HTMLInputElement>(null);
 const incomingCount=chat.messages.filter(m=>m.from!==chat.identity).length;const unread=Math.max(0,incomingCount-readCount);
 const [dialog,setDialog]=useState<"friends"|"safety"|"report"|"block"|null>(null);
 const [reason,setReason]=useState(reasons[0]);const end=useRef<HTMLDivElement>(null);const [duration,setDuration]=useState(0);
 const active=["waiting","connecting","connected"].includes(chat.status);const busy=chat.status==="preparing";
 const profile={name,code,adult,interests:[]};
 useEffect(()=>{const saved=localStorage.getItem("chitchat-preferences");if(saved){try{const p=JSON.parse(saved);if(typeof p.name==="string")setName(p.name);}catch{}}},[]);
 useEffect(()=>{localStorage.setItem("chitchat-preferences",JSON.stringify({name}));},[name]);
 useEffect(()=>{const log=end.current?.parentElement;if(log)log.scrollTop=log.scrollHeight;},[chat.messages,chatOpen]);
 useEffect(()=>{if(chatOpen||window.matchMedia("(min-width: 801px)").matches)setReadCount(incomingCount);},[incomingCount,chatOpen]);
 useEffect(()=>{setChatOpen(false);setReadCount(0);setDraft("");},[chat.peer?.id]);
 function openMessages(){setChatOpen(v=>!v);setReadCount(incomingCount);}
 useEffect(()=>{if(chatOpen)messageInput.current?.focus({preventScroll:true});},[chatOpen]);
 useEffect(()=>{setDuration(0);if(chat.status!=="connected")return;const t=setInterval(()=>setDuration(x=>x+1),1000);return()=>clearInterval(t);},[chat.status]);
 useEffect(()=>{
   const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;
   if(!context?.registerTool)return;const control=new AbortController();
   void Promise.resolve(context.registerTool({name:"stop_chitchat_call",description:"End this video chat, leave matching, and release camera and microphone.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("Expected an empty object");chat.stop();return {stopped:true};}},{signal:control.signal})).catch(()=>{});
   return()=>control.abort();
 },[chat.stop]);
 function submitMessage(e:React.FormEvent){e.preventDefault();if(draft.trim()&&chat.send("chat",{text:draft.trim()}))setDraft("");}
 const statusText={idle:"Ready when you are",preparing:"Getting your camera ready",waiting:"Finding your next conversation",connecting:"Connecting your video",connected:"You're connected",error:"Let's try that again"}[chat.status];
 return <div className="app-shell">
  <header className="topbar">
   <a className="brand" href="/" aria-label="ChitChat home"><span className="brand-mark"><MessageCircle size={23} strokeWidth={2.6}/></span>chitchat<span className="brand-period">.</span></a>
   <nav aria-label="Main navigation"><span className="nav-active"><Video size={17}/> Discover</span><button onClick={()=>setDialog("friends")}><Users size={17}/> Friends {chat.friends.length>0&&<span className="count">{chat.friends.length}</span>}</button></nav>
   <button className="safety-link" onClick={()=>setDialog("safety")}><ShieldCheck size={17}/><span>Stay safe</span></button>
  </header>
  <main className="workspace">
   <div className="page-heading"><div><div className="eyebrow">A LITTLE HELLO GOES A LONG WAY</div><h1>Good conversations start here<span>.</span></h1></div><span className="trial-label">EARLY ACCESS <span>/</span> 18+</span></div>
   <div className={"call-layout "+(chat.peer?"in-call ":"")+(chatOpen?"chat-open":"")}>
    <section className="call-column" aria-label="Video conversation">
     <div className={"video-stage "+(chat.remoteStream?"has-video":"")}>
      <div className="stage-top"><span className="live-label"><span className={chat.status==="connected"?"status-dot connected":"status-dot"}/>{chat.status==="connected"?"LIVE CONVERSATION":"YOUR NEXT CONNECTION"}</span><div className="stage-actions">{chat.status==="connected"&&<span className="timer">{Math.floor(duration/60).toString().padStart(2,"0")}:{(duration%60).toString().padStart(2,"0")}</span>}{chat.peer&&<button className="call-message-button" aria-label={unread?"Messages, "+unread+" unread":"Messages"} aria-controls="call-chat" aria-expanded={chatOpen} onClick={openMessages}><MessageCircle size={17}/><span>Messages</span>{unread>0&&<b>{unread}</b>}</button>}</div></div>
      <Feed stream={chat.remoteStream} className="remote-video"/>
      {!chat.remoteStream&&<div className="stage-empty">
       <div className="conversation-icon"><MessageCircle size={42} strokeWidth={1.5}/><span><Sparkles size={17}/></span></div>
       <h2>{chat.status==="waiting"?"Someone new is worth the wait.":chat.status==="connecting"?"A new hello is on its way.":busy?"Make yourself comfortable.":"Your next friend is a hello away."}</h2>
       <p>{chat.status==="waiting"?"Keep this tab open. We'll connect you when another person joins.":chat.status==="connecting"?"Setting up your private video connection…":busy?"Allow your camera and microphone to join the conversation.":"Meet new people, share a laugh, and see where the conversation goes."}</p>
       {(active||busy)&&<LoaderCircle className="spin" size={22}/>}
      </div>}
      <div className="self-view"><Feed stream={chat.stream} muted className={chat.cameraOff?"camera-hidden":""}/>{(!chat.stream||chat.cameraOff)&&<div className="self-empty">{chat.cameraOff?<VideoOff size={23}/>:<Camera size={25}/>}<span>{chat.cameraOff?"Camera off":"Your camera"}</span></div>}{chat.stream&&<span className="self-label">You {chat.muted&&<MicOff size={12}/>}</span>}</div>
      {chat.peer&&<div className="peer-tag"><span className="avatar">{chat.peer.name.slice(0,1).toUpperCase()}</span><div><strong>{chat.peer.name}</strong><span>{chat.status==="connected"?"Connected":"Connecting…"}</span></div></div>}
     </div>
     <div className="call-toolbar">
      <div className="call-status" role="status"><span className={"status-dot "+(chat.status==="connected"?"connected":"")}/>{statusText}</div>
      <div className="media-buttons"><button className={"icon-button "+(chat.muted?"toggled":"")} title={chat.muted?"Unmute microphone":"Mute microphone"} aria-label={chat.muted?"Unmute microphone":"Mute microphone"} aria-pressed={chat.muted} disabled={!chat.stream} onClick={chat.toggleMic}>{chat.muted?<MicOff size={19}/>:<Mic size={19}/>}</button><button className={"icon-button "+(chat.cameraOff?"toggled":"")} title={chat.cameraOff?"Turn camera on":"Turn camera off"} aria-label={chat.cameraOff?"Turn camera on":"Turn camera off"} aria-pressed={chat.cameraOff} disabled={!chat.stream} onClick={chat.toggleCamera}>{chat.cameraOff?<VideoOff size={19}/>:<Video size={19}/>}</button><span className="toolbar-divider"/><button className="icon-button" title="Report person" aria-label="Report person" disabled={!chat.peer} onClick={()=>setDialog("report")}><Flag size={18}/></button><button className="icon-button" title="Block person" aria-label="Block person" disabled={!chat.peer} onClick={()=>setDialog("block")}><Ban size={18}/></button></div>
     </div>
     <div className="action-row">{active?<><button className="primary-button next-button" onClick={()=>chat.next([])}><SkipForward size={20}/> Next person</button><button className="secondary-button" onClick={chat.stop}><Square size={16}/> Stop</button></>:busy?<button className="secondary-button" onClick={chat.stop}><X size={18}/> Cancel</button>:<button className="primary-button start-button" disabled={!name.trim()||!adult} onClick={()=>void chat.start(profile)}><Video size={20}/> Start a conversation</button>}<span><ShieldCheck size={16}/> Your camera. Your control.</span></div>
     {chat.error&&<div className="feedback error" role="alert">{chat.error}</div>}
     {chat.notice&&<div className="feedback" role="status">{chat.notice}</div>}
    </section>
    <aside className="chat-panel" id="call-chat" aria-label="Conversation messages" onKeyDown={e=>{if(e.key==="Escape"){setChatOpen(false);document.querySelector<HTMLButtonElement>(".call-message-button")?.focus();}}}>
     <div className="chat-header"><div><MessageCircle size={18}/><h2>Chat</h2></div><span>{chat.peer?chat.peer.name:""}</span>{chat.peer&&<button className="chat-close icon-button" aria-label="Close messages" onClick={()=>{setChatOpen(false);document.querySelector<HTMLButtonElement>(".call-message-button")?.focus();}}><X size={17}/></button>}</div>
     {!active&&!busy&&!chat.peer?<div className="onboarding">
      <label htmlFor="display-name">What should we call you?</label><input id="display-name" placeholder="Your first name or nickname" autoComplete="nickname" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/>
      <label htmlFor="access-code">Tester access code <span>if provided</span></label><input id="access-code" placeholder="Enter your invite code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/>
      <label className="age-check" htmlFor="adult"><Checkbox id="adult" checked={adult} onCheckedChange={v=>setAdult(v===true)}/><span>I am 18 or older and agree to the <button onClick={e=>{e.preventDefault();setDialog("safety");}}>community guidelines</button>.</span></label>
     </div>:<>
      <div className="messages" role="log" aria-label="Chat messages" aria-live="polite">
       {chat.messages.length===0&&<div className="chat-intro"><MessageCircle size={24}/><p>{chat.peer?"Say hello 👋":"Messages will appear here."}</p></div>}
       {chat.messages.map(m=><div key={m.id} className={"message "+(m.from===chat.identity?"mine":"theirs")}><span>{m.from===chat.identity?"You":chat.peer?.name}</span><p>{m.text}</p></div>)}<div ref={end}/>
      </div>
      {chat.peer&&<div className="friend-prompt"><button disabled={chat.friendState==="added"||chat.friendState==="sent"} onClick={()=>chat.send("friend-request")}><UserPlus size={15}/>{chat.friendState==="added"?"Friends":chat.friendState==="sent"?"Request sent":chat.friendState==="incoming"?"Accept request":"Add friend"}</button></div>}
     </>}
     <form className="message-form" onSubmit={submitMessage}><input ref={messageInput} aria-label="Message" placeholder="Type a message…" maxLength={1000} disabled={!chat.peer} value={draft} onChange={e=>setDraft(e.target.value)}/><button aria-label="Send message" disabled={!chat.peer||!draft.trim()}><Send size={18}/></button></form>
     
    </aside>
   </div>
   <footer className="page-footer"><span>Less scrolling. More connecting.</span><button onClick={()=>setDialog("safety")}>Community guidelines</button></footer>
  </main>
  <Dialog open={dialog!==null} onOpenChange={open=>{if(!open)setDialog(null);}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>{dialog==="friends"?"Your people":dialog==="report"?"Report this conversation":dialog==="block"?"Block this person?":"A good space starts with us."}</DialogTitle><DialogDescription>{dialog==="friends"?"Keep a good conversation going. Both people must accept to become friends.":dialog==="report"?"Submitting a report also blocks this person and ends the call.":dialog==="block"?"This ends the call and prevents future matches with this browser identity.":"ChitChat is for adults 18 and older. Be kind, be yourself, and respect each other's boundaries."}</DialogDescription></DialogHeader>
   {dialog==="friends"&&<div className="friends-list">{chat.friends.length===0?<div className="dialog-empty"><Users size={36}/><h3>Good friends start as strangers.</h3><p>Add someone during a call to see them here. Your friends are linked to this browser.</p></div>:chat.friends.map(f=><div className="friend-row" key={f.id}><span className="avatar">{f.name[0].toUpperCase()}</span><div><strong>{f.name}</strong><span>{f.online?"Online":"Offline"}</span></div><button className="secondary-button" disabled={!f.online||active||busy||!name.trim()||!adult} onClick={()=>{void chat.start(profile,undefined,f.id);setDialog(null);}}>Invite</button></div>)}</div>}
   {dialog==="safety"&&<div className="guidelines"><p><strong>Respect comes first.</strong> No harassment, hate, nudity, sexual content, scams, or pressure to share personal details.</p><p><strong>You're in control.</strong> Leave any time. Use block or report if someone makes you uncomfortable.</p><p><strong>Protect your privacy.</strong> Don't share your address, passwords, or financial information. We don't record calls, but another person could record their screen. Direct calls can reveal your network address to the other participant.</p><p><strong>Early access.</strong> Reports are saved for the host to review; this trial has no live moderation team. Browser-based blocking can be evaded by clearing cookies. Use this version only with invited adult testers.</p></div>}
   {dialog==="report"&&<><RadioGroup value={reason} onValueChange={setReason}>{reasons.map((r,i)=><label className="reason-row" key={r} htmlFor={"reason-"+i}><RadioGroupItem id={"reason-"+i} value={r}/>{r}</label>)}</RadioGroup><button className="danger-button" disabled={!chat.peer} onClick={()=>{chat.send("report",{reason});setDialog(null);}}>Submit report & block</button></>}
   {dialog==="block"&&<button className="danger-button" disabled={!chat.peer} onClick={()=>{chat.send("block");setDialog(null);}}>Block & end conversation</button>}
  </DialogContent></Dialog>
  <Dialog open={!!chat.invitation} onOpenChange={open=>{if(!open)chat.setInvitation(null);}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>A familiar hello</DialogTitle><DialogDescription>{chat.invitation?.name} invited you to a video call. Your camera and microphone will turn on if you accept.</DialogDescription></DialogHeader><button className="primary-button" disabled={active||busy||!name.trim()||!adult} onClick={()=>{if(chat.invitation)void chat.start(profile,chat.invitation.key);}}>Accept video call</button>{(active||busy)&&<p>Finish your current chat first.</p>}</DialogContent></Dialog>
 </div>;
}


