"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type Status="idle"|"preparing"|"waiting"|"connecting"|"connected"|"error";
export type Person={id:string;name:string;interests?:string[];online?:boolean};
export type ChatMessage={id:string;from:string;text:string;time:number};
type Signal={kind:"offer"|"answer"|"candidate";description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
export function useChitchat() {
 const [status,setStatus]=useState<Status>("idle");
 const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const [peer,setPeer]=useState<Person|null>(null); const [friends,setFriends]=useState<Person[]>([]);
 const [messages,setMessages]=useState<ChatMessage[]>([]);const [friendState,setFriendState]=useState("none");
 const [invitation,setInvitation]=useState<{key:string;name:string}|null>(null);
 const [muted,setMuted]=useState(false);const [cameraOff,setCameraOff]=useState(false);
 const [stream,setStream]=useState<MediaStream|null>(null);const [remoteStream,setRemoteStream]=useState<MediaStream|null>(null);
 const [identity,setIdentity]=useState("");const [relayConfigured,setRelayConfigured]=useState(false);
 const ws=useRef<WebSocket|null>(null);const pc=useRef<RTCPeerConnection|null>(null);
 const media=useRef<MediaStream|null>(null);const room=useRef<string|null>(null);
 const ice=useRef<RTCIceServer[]>([]);const icePolicy=useRef<RTCIceTransportPolicy>("all");const candidates=useRef<RTCIceCandidateInit[]>([]);
 const epoch=useRef(0);const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const recoveryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const invitationTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const send=useCallback((type:string,data:Record<string,unknown>={})=>{
   if(ws.current?.readyState!==WebSocket.OPEN)return false;
   ws.current.send(JSON.stringify({type,room:room.current,...data}));return true;
 },[]);
 const clearPeer=useCallback(()=>{
   if(timeout.current)clearTimeout(timeout.current);if(recoveryTimer.current)clearTimeout(recoveryTimer.current);
   if(pc.current){pc.current.onconnectionstatechange=null;pc.current.onicecandidate=null;pc.current.ontrack=null;pc.current.close();}
   pc.current=null;room.current=null;candidates.current=[];setPeer(null);setRemoteStream(null);setFriendState("none");setMessages([]);
 },[]);
 const releaseMedia=useCallback(()=>{media.current?.getTracks().forEach(t=>t.stop());media.current=null;setStream(null);setMuted(false);setCameraOff(false);},[]);
 const stop=useCallback(()=>{epoch.current++;send("stop");clearPeer();releaseMedia();setStatus("idle");setError("");},[send,clearPeer,releaseMedia]);
 const fail=useCallback((message:string)=>{epoch.current++;send("stop");clearPeer();releaseMedia();setStatus("error");setError(message);},[send,clearPeer,releaseMedia]);
 const receive=useRef<(m:any)=>Promise<void>>(async()=>{});
 receive.current=async m=>{
   if(m.type==="friends"){setFriends(m.friends);return;}
   if(m.type==="waiting"){setStatus("waiting");return;}
   if(m.type==="matched"){
     if(!media.current){send("stop");return;}
     clearPeer();room.current=m.room;setPeer(m.peer);setStatus("connecting");setNotice("");setFriendState(m.friends?"added":"none");
     const connection=new RTCPeerConnection({iceServers:ice.current,iceTransportPolicy:icePolicy.current});pc.current=connection;
     for(const track of media.current.getTracks()){
       const sender=connection.addTrack(track,media.current!);
       if(track.kind==="video"){
         // Keep faces sharp; WebRTC can reduce frame rate on slower connections.
         const parameters=sender.getParameters();
         if(!parameters.encodings?.length)parameters.encodings=[{}];
         parameters.encodings[0].maxBitrate=3_000_000;
         parameters.encodings[0].maxFramerate=30;
         parameters.degradationPreference="maintain-resolution";
         try{await sender.setParameters(parameters);}catch{/* Browser defaults when unsupported. */}
       }
     }
     connection.onicecandidate=e=>{if(e.candidate&&room.current===m.room)send("signal",{signal:{kind:"candidate",candidate:e.candidate.toJSON()}});};
     connection.ontrack=e=>{if(pc.current===connection)setRemoteStream(e.streams[0]||new MediaStream([e.track]));};
     connection.onconnectionstatechange=()=>{
       if(pc.current!==connection)return;
       if(connection.connectionState==="connected"){if(recoveryTimer.current)clearTimeout(recoveryTimer.current);if(timeout.current)clearTimeout(timeout.current);setStatus("connected");setNotice("");}
       if(connection.connectionState==="failed")fail("The video connection failed. Try another network or ask the host to configure a TURN relay.");
       if(connection.connectionState==="disconnected"){
         setNotice("Connection interrupted. Trying to recover…");
         if(recoveryTimer.current)clearTimeout(recoveryTimer.current);
         recoveryTimer.current=setTimeout(()=>{if(pc.current===connection&&connection.connectionState!=="connected")fail("The call disconnected. Check your internet and start again.");},12000);
       }
     };
     timeout.current=setTimeout(()=>{if(pc.current===connection&&connection.connectionState!=="connected")fail("Could not connect this call. A TURN relay may be needed on your network.");},25000);
     if(m.initiator){
       const offer=await connection.createOffer();
       if(pc.current!==connection)return;await connection.setLocalDescription(offer);
       if(pc.current===connection)send("signal",{signal:{kind:"offer",description:connection.localDescription}});
     }
   }else if(m.type==="signal"&&m.room===room.current&&pc.current){
     const connection=pc.current;const s=m.signal as Signal;
     if(s.kind==="candidate"){
       if(s.candidate){if(connection.remoteDescription)await connection.addIceCandidate(s.candidate);else candidates.current.push(s.candidate);}
     }else if(s.description){
       await connection.setRemoteDescription(s.description);
       if(pc.current!==connection)return;
       for(const candidate of candidates.current)await connection.addIceCandidate(candidate);candidates.current=[];
       if(s.kind==="offer"){
         const answer=await connection.createAnswer();if(pc.current!==connection)return;
         await connection.setLocalDescription(answer);if(pc.current===connection)send("signal",{signal:{kind:"answer",description:connection.localDescription}});
       }
     }
   }else if(m.type==="peer-left"){clearPeer();releaseMedia();setStatus("idle");setNotice("They left the conversation. Start a new chat when you're ready.");}
   else if(m.type==="chat"&&m.room===room.current)setMessages(old=>[...old.slice(-199),m]);
   else if(m.type==="friend-request")setFriendState("incoming");
   else if(m.type==="friend-sent")setFriendState("sent");
   else if(m.type==="friend-added"){setFriendState("added");setNotice("You're now friends. Find each other in your friends list.");}
   else if(m.type==="blocked"){clearPeer();releaseMedia();setStatus("idle");setNotice(m.reported?"Report saved and person blocked.":"Person blocked. You won't be matched again with this browser identity.");}
   else if(m.type==="invitation"){
     setInvitation({key:m.key,name:m.name});
     if(invitationTimer.current)clearTimeout(invitationTimer.current);
     invitationTimer.current=setTimeout(()=>setInvitation(null),30000);
   }else if(m.type==="notice")setNotice(m.message);
   else if(m.type==="invite-failed")fail(m.message);
   else if(m.type==="error")setError(m.message);
 };
 const connect=async()=>{
   if(ws.current?.readyState===WebSocket.OPEN)return;
   await new Promise<void>((resolve,reject)=>{
     const socket=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws");ws.current=socket;
     let opened=false;
     const timer=setTimeout(()=>{socket.close();reject(new Error("The chat server is taking too long. Please try again."));},15000);
     let chain=Promise.resolve();
     socket.onmessage=e=>{chain=chain.then(()=>receive.current(JSON.parse(e.data))).catch(()=>fail("The call could not be established. Please try again."));};
     socket.onopen=()=>{opened=true;clearTimeout(timer);resolve();};
     socket.onerror=()=>{clearTimeout(timer);reject(new Error("Can't reach the chat server. Please try again."));};
     socket.onclose=e=>{
       clearTimeout(timer);
       if(!opened)reject(new Error("The chat server is unavailable."));
       if(ws.current===socket){ws.current=null;fail(e.code===4001?"This session was opened in another tab. Use a different browser profile for a second tester.":"Connection to the chat server was lost. Press Start to reconnect.");}
     };
   });
 };
 const start=async(profile:{name:string;code:string;adult:boolean;interests:string[]},inviteKey?:string,inviteTarget?:string)=>{
   const ticket=++epoch.current;setError("");setNotice("");setStatus("preparing");
   try{
     const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(profile)});
     const data=await response.json() as {id:string;iceServers:RTCIceServer[];relayConfigured:boolean;iceTransportPolicy?:RTCIceTransportPolicy;error?:string};if(!response.ok)throw new Error(data.error||"Unable to start.");
     if(ticket!==epoch.current)return;
     setIdentity(data.id);ice.current=data.iceServers;icePolicy.current=data.iceTransportPolicy==="relay"?"relay":"all";setRelayConfigured(data.relayConfigured);
     if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access needs HTTPS or localhost and a supported browser.");
     const captured=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30},facingMode:{ideal:"user"}},audio:{echoCancellation:true,noiseSuppression:true}});
     captured.getVideoTracks().forEach(track=>{track.contentHint="detail";});
     if(ticket!==epoch.current){captured.getTracks().forEach(t=>t.stop());return;}
     media.current=captured;setStream(captured);setMuted(false);setCameraOff(false);
     await connect();if(ticket!==epoch.current)return;
     if(inviteTarget){send("invite",{target:inviteTarget});setStatus("waiting");timeout.current=setTimeout(()=>{if(!room.current)fail("Your friend did not join. You can try again.");},35000);}
     else if(inviteKey){send("accept-invite",{key:inviteKey});setInvitation(null);setStatus("connecting");}
     else {send("join",{interests:profile.interests});setStatus("waiting");}
   }catch(e){
     if(ticket!==epoch.current)return;const err=e as Error;
     fail(err.name==="NotAllowedError"?"Camera or microphone access was denied. Allow access in your browser, then try again.":err.name==="NotFoundError"?"No camera or microphone was found. Connect your devices and try again.":err.name==="NotReadableError"?"Your camera is in use by another app. Close it and try again.":err.message);
   }
 };
 const next=(interests:string[])=>{clearPeer();setError("");setNotice("");setStatus("waiting");if(!send("join",{interests}))fail("Chat server disconnected. Press Start to reconnect.");};
 const toggleMic=()=>{const next=!muted;media.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next);};
 const toggleCamera=()=>{const next=!cameraOff;media.current?.getVideoTracks().forEach(t=>t.enabled=!next);setCameraOff(next);};
 useEffect(()=>()=>{
   epoch.current++;if(timeout.current)clearTimeout(timeout.current);if(invitationTimer.current)clearTimeout(invitationTimer.current);if(recoveryTimer.current)clearTimeout(recoveryTimer.current);
   const socket=ws.current;ws.current=null;socket?.close();pc.current?.close();media.current?.getTracks().forEach(t=>t.stop());
 },[]);
 return {status,error,notice,peer,friends,messages,friendState,invitation,setInvitation,muted,cameraOff,stream,remoteStream,identity,relayConfigured,start,stop,next,toggleMic,toggleCamera,send};
}


