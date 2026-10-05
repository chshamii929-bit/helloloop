# ChitChat ko testing mode mein kaise le jana hai

## Abhi kya ready hai
- Real WebRTC audio/video calls, random matching, Next, Stop.
- Call ke upar Messages button. Mobile par chat video ke paas khulti hai; unread count bhi hai.
- Mic/camera controls, friends, return calls, report/block.
- Browser autoplay block kare to Play video & audio button.
- Connection drop recover na ho to 12 seconds ke baad clear error aur device cleanup.
- HTTPS staging configuration, tester access code aur optional TURN/relay-only testing.
- Physical devices aur external networks ka test abhi user ke saath karna hai. Automated tests synthetic camera/audio use karte hain.

## 1. Pehle apne PC par test
Project terminal mein:
```powershell
cd C:\Users\CH_SHAMII\Desktop\chitchat\app
npm ci
npm run build
npm run staging:check
npm start
```
Agar app pehle se port 3000 par chal rahi hai, doosra server start na karo. Backend badalne par usi server ko stop karke restart karo.

1. Chrome mein http://localhost:3000 kholo.
2. Doosre tester ke liye Edge, doosra browser profile, ya incognito window kholo. Same profile ki do tabs ek hi user hain.
3. Dono mein name enter karo, 18+ confirm karo, aur Start dabao.
4. Camera aur microphone Allow karo. Ek user akela ho to waiting screen expected hai.
5. Dono ko video/audio milna chahiye. Ek PC par do physical camera sessions kaam na karein to do devices ka HTTPS test karo.
6. Headphones use karo, warna same-room audio feedback aa sakti hai.
7. Messages, mute, camera off/on aur Stop test karo.
8. Next ko test karne ke liye teesra tester rakho: app immediately previous person se dobara random match nahi karti.
9. Dono friends accept karein, Stop karein, phir Friends > Invite se return call test karein.
10. Report/block test ke baad woh browser identities dobara random match nahi hongi.

Automated checks:
```powershell
npm test
npm run test:browser
```
Browser test ke liye installed Chrome chahiye. Ye synthetic camera/audio aur isolated sessions se real WebRTC connection banata hai.

## 2. Online private staging
Required: apna GitHub repository aur Render account. Repository mein source aur package-lock.json push karo; .env, .data, node_modules ya credentials push mat karo.

Render par Node **Web Service** banao, Static Site nahi:
- Repository select karo.
- Agar repository ke andar app/ directory hai: Root Directory = app.
- Build command = npm ci --no-audit --no-fund && npm run build
- Start command = npm start
- Instance plan = Free
- Health check = /health
- Node version = 24.12.0 (NODE_VERSION).
- NODE_ENV = production.
- PUBLIC_ORIGIN = Render ka exact https://...onrender.com origin, trailing slash ke baghair.
- SESSION_SECRET = kam az kam 32 random characters.
- STAGING_ACCESS_CODE = strong private tester code (kam az kam 12 characters).
- MAX_CONNECTIONS = 100 is only a limit, verified capacity claim nahi.

app/render.yaml bhi same free-service settings deta hai. Monorepo ke liye root directory manually verify karo. Agar initial deploy origin set hone se pehle fail ho, generated HTTPS URL ko PUBLIC_ORIGIN mein save karke redeploy karo.

Secrets Render environment settings mein save karo; chat, screenshots ya git mein share mat karo. Service boot ke liye origin, session secret aur access code required hain.

Local .env mein staging settings configure karke format check karna ho:
```powershell
npm run staging:check -- --hosted
```
Ye settings ki presence/format check karta hai, provider credentials ya network connectivity prove nahi karta.

## 3. Alag networks par video: TURN
Direct WebRTC har network par connect nahi hota. Kisi TURN provider ka current free allowance, expiry aur billing policy verify karke tester credentials lo. Is app ne koi TURN account ya paid service enable nahi ki.

Host environment mein:
- TURN_URLS = provider ke comma-separated turn:/turns: URLs
- TURN_USERNAME = scoped tester username
- TURN_CREDENTIAL = scoped tester credential
- ICE_TRANSPORT_POLICY = all (default)

TURN credentials WebRTC browser ko milte hain; production mein short-lived scoped credentials use karna hai.

Relay ko actually verify karne ke liye temporary ICE_TRANSPORT_POLICY=relay set karke redeploy karo. Do devices ki call successful honi chahiye; phir all par wapas aa jao. Relay-only mode bina complete TURN settings ke server start nahi hone dega. Configured credentials ka matlab working relay proof nahi hai.

## 4. Real-device test order
Pehle 2–5 invited adult testers:
- Laptop + phone, same Wi-Fi.
- Phone Wi-Fi + doosra phone mobile data.
- Android Chrome; iPhone Safari if available.
- Camera denied -> clear error -> permission allow -> retry.
- Call ke dauran Messages kholo/send/close; video aur audio continue rahein.
- Phone keyboard khulne par message input usable ho.
- Microphone/camera off/on; Stop ke baad devices release hon.
- Next with three testers; peer leaving; tab refresh.
- Brief network interruption, then recovery or clear timeout.
- Friends/return calls; report/block.
- TURN relay-only test.
- 5-minute call: echo, frozen frames, dropped audio check karo.

Phone par http://192.168... jaisa plain HTTP address reliable camera test nahi hai. Browser camera/mic ke liye HTTPS chahiye; localhost exemption phone ke apne localhost ko apply hoti hai, PC ko nahi.

## 5. Free tier ki limits
Render Free inactivity ke baad sleep karti hai; pehli request mein delay ho sakta hai. Filesystem temporary hai: deploy/restart par SQLite users/friends/reports/blocks reset ho sakte hain. Sirf disposable tester data use karo. Persistent data ya public launch se pehle durable database aur moderation workflow required hain.

Abhi hosted staging deploy, physical camera tests aur real TURN/network tests complete hone ka claim nahi hai.

Official references:
- https://render.com/docs/free
- https://render.com/docs/web-services
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://webrtc.org/getting-started/turn-server


## Suggested TURN trial
Metered ki current pricing page par 500 MB monthly TURN trial, $0/month aur no credit card required likha hai. Ye limited connectivity testing ke liye hai, unlimited video traffic ke liye nahi. https://www.metered.ca/pricing

1. https://dashboard.metered.ca/signup?tool=turnserver par free TURN account banao.
2. TURN Server > Credentials mein tester credential create karo.
3. Provider ke TURN URLs, username aur credential ko Render ke TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL mein save karo.
4. Paid plan, balance top-up ya auto-reload enable mat karo. Dashboard mein trial allowance verify karo.
5. Relay-only call test ke baad normal all mode restore karo.

Dashboard reference: https://www.metered.ca/docs/dashboard/new-dashboard/


## Repository Blueprint deployment
The root render.yaml targets chshamii929-bit/helloloop, main branch, rootDir app and a Free Node Web Service. Render generates SESSION_SECRET and STAGING_ACCESS_CODE and supplies PUBLIC_ORIGIN from this service's RENDER_EXTERNAL_URL. Use the generated access code from the Render dashboard for invited testers. With this Blueprint, entering the origin manually is unnecessary. Manual Web Service setup instructions above still apply when not using the Blueprint.
