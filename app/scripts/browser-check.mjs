import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../server/index.mjs';
mkdirSync('artifacts',{recursive:true});mkdirSync('.data',{recursive:true});
const dataDir=mkdtempSync(resolve('.data','browser-test-'));
const app=createApp({dataDir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+app.server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[];const checks=[];
try{
 async function user(name){
  const context=await browser.newContext({viewport:{width:1440,height:1040},permissions:['camera','microphone']});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const originalPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(window.forcePlayBlock&&this.classList.contains('remote-video')){window.forcePlayBlock=false;return Promise.reject(new DOMException('User gesture required','NotAllowedError'));}return originalPlay.call(this);};
    window.testTools={};document.modelContext={registerTool(tool,options){window.testTools[tool.name]=tool;options.signal.addEventListener('abort',()=>delete window.testTools[tool.name]);}};});
  await page.goto(origin);await page.getByRole('heading',{name:'Good conversations start here.'}).waitFor();
  await page.getByLabel('What should we call you?').fill(name);await page.getByRole('checkbox').check();
  return {page,context};
 }
 const a=await user('Ali'),b=await user('Sara');
 await a.page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 await a.page.setViewportSize({width:390,height:844});await a.page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('Mobile has no horizontal overflow');
 await a.page.setViewportSize({width:1440,height:1040});
 await a.page.evaluate(()=>{window.forcePlayBlock=true;});
 await a.page.getByRole('button',{name:'Start a conversation',exact:true}).click();
 await a.page.getByText('Finding your next conversation',{exact:true}).waitFor();
 await b.page.getByRole('button',{name:'Start a conversation',exact:true}).click();
 await Promise.all([a.page.getByText("You're connected",{exact:true}).waitFor({timeout:30000}),b.page.getByText("You're connected",{exact:true}).waitFor({timeout:30000})]);
 assert.equal(await a.page.locator('.remote-video').evaluate(v=>v.srcObject?.getVideoTracks().length),1);checks.push('Two isolated browser users connect real WebRTC with fake camera/audio');
 await a.page.getByRole('button',{name:'Play video & audio',exact:true}).click();
 await a.page.waitForFunction(()=>document.querySelector('.remote-video').videoWidth>0);
 checks.push('Remote video decodes frames; autoplay recovery button resumes playback');

 await a.page.getByLabel('Message',{exact:true}).fill('Hello Sara!');await a.page.getByRole('button',{name:'Send message',exact:true}).click();
 await b.page.getByText('Hello Sara!',{exact:true}).waitFor();checks.push('Text chat reaches the other browser');
 await a.page.setViewportSize({width:390,height:844});
 await a.page.locator('.video-stage').scrollIntoViewIfNeeded();
 const scrollBefore=await a.page.evaluate(()=>window.scrollY);
 assert.equal(await a.page.getByLabel('Message',{exact:true}).isVisible(),false);
 await b.page.getByLabel('Message',{exact:true}).fill('Mobile message');
 await b.page.getByRole('button',{name:'Send message',exact:true}).click();
 await a.page.getByRole('button',{name:'Messages, 1 unread',exact:true}).waitFor();
 assert.equal(await a.page.evaluate(()=>window.scrollY),scrollBefore);
 await a.page.getByRole('button',{name:'Messages, 1 unread',exact:true}).click();
 await a.page.getByText('Mobile message',{exact:true}).waitFor();
 await a.page.getByLabel('Message',{exact:true}).fill('Reply without leaving video');
 await a.page.getByRole('button',{name:'Send message',exact:true}).click();
 await b.page.getByText('Reply without leaving video',{exact:true}).waitFor();
 const stage=await a.page.locator('.video-stage').boundingBox(),panel=await a.page.locator('#call-chat').boundingBox();
 assert.ok(panel.y>=stage.y&&panel.y<stage.y+stage.height);
 assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await a.page.screenshot({path:'artifacts/mobile-in-call-chat.png',fullPage:true});
 await a.page.getByRole('button',{name:'Close messages',exact:true}).click();
 assert.equal(await a.page.getByLabel('Message',{exact:true}).isVisible(),false);
 await a.page.setViewportSize({width:1440,height:1040});
 checks.push('In-call mobile chat opens beside video, shows unread messages, sends replies and closes without page jumps');

 await a.page.getByRole('button',{name:'Mute microphone',exact:true}).click();
 assert.equal(await a.page.locator('.self-view video').evaluate(v=>v.srcObject.getAudioTracks()[0].enabled),false);
 await a.page.getByRole('button',{name:'Turn camera off',exact:true}).click();
 assert.equal(await a.page.locator('.self-view video').evaluate(v=>v.srcObject.getVideoTracks()[0].enabled),false);checks.push('Microphone and camera buttons disable actual tracks');
 await a.page.getByRole('button',{name:'Add friend',exact:true}).click();await b.page.getByRole('button',{name:'Accept request',exact:true}).click();
 await a.page.getByRole('button',{name:'Friends',exact:true}).waitFor();
 await a.page.getByRole('button',{name:'Stop',exact:true}).click();
 await b.page.getByText('They left the conversation.',{exact:false}).waitFor();
 assert.equal(await a.page.locator('.self-view video').evaluate(v=>v.srcObject),null);checks.push('Stop releases camera and informs peer');
 await a.page.getByRole('button',{name:/Friends 1/}).click();await a.page.getByRole('button',{name:'Invite',exact:true}).click();
 await b.page.getByRole('button',{name:'Accept video call',exact:true}).click();
 await Promise.all([a.page.getByText("You're connected",{exact:true}).waitFor({timeout:30000}),b.page.getByText("You're connected",{exact:true}).waitFor({timeout:30000})]);
 checks.push('Mutual friendship and a return-call invitation work end to end');
 await a.page.getByRole('button',{name:'Report person',exact:true}).click();
 await a.page.getByLabel('Harassment',{exact:true}).check();await a.page.getByRole('button',{name:'Submit report & block',exact:true}).click();
 await a.page.getByText('Report saved and person blocked.',{exact:true}).waitFor();assert.equal(app.store.reports().length,1);
 checks.push('Report is persisted and peer is blocked');
 await a.page.getByRole('button',{name:'Start a conversation',exact:true}).click();await b.page.getByRole('button',{name:'Start a conversation',exact:true}).click();
 await Promise.all([a.page.getByText('Finding your next conversation',{exact:true}).waitFor(),b.page.getByText('Finding your next conversation',{exact:true}).waitFor()]);
 const c=await user('Omar');await c.page.getByRole('button',{name:'Start a conversation',exact:true}).click();
 await a.page.getByText("You're connected",{exact:true}).waitFor({timeout:30000});
 await a.page.getByRole('button',{name:'Next person',exact:true}).click();await a.page.getByText('Finding your next conversation',{exact:true}).waitFor();
 await c.page.getByText('They left the conversation.',{exact:false}).waitFor();checks.push('Blocked identities do not rematch; Next releases current partner');
 const invalid=await a.page.evaluate(async()=>{try{await window.testTools.stop_chitchat_call.execute({bad:true});return false;}catch{return true;}});assert.equal(invalid,true);
 await a.page.evaluate(()=>window.testTools.stop_chitchat_call.execute({}));await a.page.getByText('Ready when you are',{exact:true}).waitFor();checks.push('Browser tool validation and stop action work in a test registry');
 assert.deepEqual(errors,[]);checks.push('No browser runtime errors');
 console.log(JSON.stringify({checks,errors},null,2));
}catch(e){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0])await pages[0].screenshot({path:'artifacts/failure.png',fullPage:true});throw e;}
finally{await browser.close();await app.close();rmSync(dataDir,{recursive:true,force:true});}

