# ChitChat

A video-first app for invited adult testers. Next.js/React frontend, Node.js 24 server, WebSockets for matchmaking/signalling, browser WebRTC for audio/video, and SQLite for server-owned records. No paid API is required for local development.

Full Roman Urdu instructions: [TESTING.md](TESTING.md). Run `npm run staging:check` for a configuration check.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3000. Use two separate browser profiles (or a regular and an incognito window), enter different display names, confirm 18+, and press Start in each. Two tabs sharing cookies are the same identity; opening the second connection replaces the first.

`npm run dev` builds and starts this integrated app. It does not hot-reload; rebuild after source changes.

```sh
npm test
npm run typecheck
npm run reports
```

## Working features

- Explicit camera/microphone permissions; local and remote video.
- Random queue, Next, Stop, disconnect handling.
- Microphone and camera toggles. Stop releases both devices.
- Live text chat beside the call, mobile Messages overlay and unread counts; cleared at the end of a conversation.
- Mutual friend requests, online friend list, consent-based return-call invitations.
- Server-side blocks and reports stored in SQLite; no audio/video recording.
- Anonymous signed HttpOnly browser identity; origin checks, payload limits, per-connection action limits, session creation throttling and a configurable connection cap.

Friends are tied to a browser cookie, not a verified account. Clearing cookies creates a new identity and can evade blocks. Friends reappear after starting a session on the same browser. Reports are stored for manual review with `npm run reports`; there is no staffed moderation service.

## Free staging

`render.yaml` defines a **Free** Node web service and no paid database or disk. Import this repository through your Render account; if the repository root contains this app folder, set the service root directory to `app`. Set PUBLIC_ORIGIN to the exact HTTPS service origin, a private STAGING_ACCESS_CODE, and a long SESSION_SECRET. Give the code only to invited adult testers. No external service has been provisioned by this source code.

Render Free sleeps after inactivity. Its filesystem is ephemeral: **SQLite users, friends, blocks, reports, and sessions can reset after a restart/redeploy**. Use disposable data during this trial. Local SQLite survives ordinary process restarts. Before a durable external trial, migrate storage to a persistent database with a verified free allowance.

Reference: https://render.com/docs/free and https://render.com/docs/websocket

## Video connectivity and privacy

The default STUN configuration enables direct connections on compatible networks. Cross-network calls are not guaranteed without TURN. Configure TURN_URLS, TURN_USERNAME and TURN_CREDENTIAL from a provider whose free quota you have checked. No relay provider or billing is automatically enabled. This version hands relay credentials to authenticated tester browsers; use short-lived scoped credentials before public production.

A call displays a recoverable error if connection fails after 25 seconds. Direct WebRTC can disclose a participant's public network address to their peer. The app does not record media, but participants can record their own screens. Chat text passes through the signalling server and is not persisted. Claims of anonymous networking or end-to-end encrypted text chat are not made.

Reference: https://webrtc.org/getting-started/turn-server

## Architecture and scale

One Node process owns the matchmaking queue; pairing is synchronous and a user can hold only one room. Room IDs prevent stale clients from sending to unrelated rooms. SQLite stores identities, friendships, blocks and reports; chat/media are not stored. This is a staging architecture, not evidence of production capacity.

The default 100-connection cap is an overload guard, not a tested capacity promise. Multiple instances require shared coordination (for example Redis), a persistent database (for example PostgreSQL), and measured load tests. Video bandwidth is peer-to-peer where possible; TURN bandwidth needs separate budgeting.

## Before public launch

Add authenticated accounts and account recovery, an enforceable age/access policy, durable moderation and abuse controls, short-lived TURN credentials, deletion/retention policies, operational monitoring, and tests across real mobile/Wi-Fi networks. Do not expose this anonymous trial as a fully moderated public service.

No production deployment has been performed. Sites was evaluated during setup; a single Node host is used because this app needs a persistent WebSocket signalling process. The generated Sites build helpers are retained but are not the app's deploy path.



### Automatic country flags
Country is estimated from the network IP using the local geoip-lite database; no location API, GPS permission or subscription is used. VPNs may show the VPN country, and unavailable countries stay unknown. Country codes are stored with profiles and shown with matched users. Cloudflare tunnel testing trusts visitor headers only on loopback with TRUST_CLOUDFLARE_PROXY=true (set by test:remote). Never enable this on an origin exposed directly to the internet. Other hosting proxies need a separately configured trusted proxy before accurate country detection. Flag SVGs are bundled locally from flag-icons (MIT); IP database attribution: geoip-lite / MaxMind GeoLite.
