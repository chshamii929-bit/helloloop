# Validation — 5 October 2026

- Next.js optimized build and TypeScript: passed.
- 12 backend tests: passed. Real HTTP/WebSocket tests cover session validation, signed cookies, origin rejection, pairing, stale room rejection, Next, disconnect cleanup, consent-based friendships, expired invites, report/block enforcement and throttling.
- A deterministic 100-user queue test produces exactly 50 two-person rooms. This is a correctness check, NOT a throughput or production load test.
- Chrome end-to-end test: passed with separate browser contexts and synthetic video/audio. Actual RTCPeerConnections were established; remote video tracks were received.
- Chat delivery, real microphone/camera track toggles, Stop device release, return-call invitation, report storage and no-rematch block behavior: passed.
- 390px mobile viewport: no horizontal overflow. Desktop/mobile screenshots in artifacts/.
- No browser runtime errors in the exercised flow.
- Optional WebMCP stop tool checked using a synthetic registry, including invalid input. Native host WebMCP integration was not available.
- Not tested: physical cameras/phones, restrictive NAT/mobile networks, TURN relay credentials, provider deployment, durable hosted storage, production capacity.
- No external hosting or paid services provisioned. Render connection is required for online staging deployment.



Latest call update: mobile in-call Messages overlay, unread notification without page scrolling, bidirectional reply, autoplay recovery and decoded remote video frames all passed Chrome checks. Relay-only configuration guard passed; actual TURN connectivity remains untested.
