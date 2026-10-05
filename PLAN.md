# ChitChat plan
1. Build the actual video-chat surface: camera preview, random matching, call controls and chat.
2. Include explicit adult tester acknowledgement, block/report and mutual friend requests.
3. Keep local development free; prepare a Free Render manifest with no paid resources.
4. Verify frontend compilation, backend security/matching behavior and browser media flows.
5. Use invited testers first. Configure a free-quota TURN service for restrictive networks.
6. Before production: persistent PostgreSQL, account authentication, moderation, monitoring, Redis coordination when multiple backend instances are introduced, and measured load testing.

The current prototype uses SQLite and a single-process WebSocket queue. This is simpler to run for free and can be replaced behind the storage/matching interfaces. Free hosted SQLite is disposable because Render's free filesystem is ephemeral; use no important user data there.

No public production launch or paid service is authorized by this plan.

