BD Islamic Messenger v4

এই সংস্করণে UI এবং বর্তমান PostgreSQL/Socket.IO backend একসাথে রাখা হয়েছে।
মূল ফ্লো: Splash -> Register -> Login -> Home.

যোগ করা/উন্নত করা হয়েছে:
- Islamic splash/login/register UI
- Friend Code search/add
- Home story row
- Profile + profile photo upload
- Settings, Language, Privacy, Notifications, Blocked Contacts, Accounts, About
- Friend profile menu: audio/video call, block/unblock, delete friend
- Text, image, video, audio/voice message UI
- Story create এবং 72-hour backend expiry
- Socket.IO realtime message/presence
- WebRTC call signaling UI

গুরুত্বপূর্ণ:
- Render-এর DATABASE_URL এবং JWT_SECRET পরিবর্তন করবেন না।
- বর্তমান server upload limit 50MB; 2GB/3GB production media-এর জন্য object storage দরকার।
- WebRTC call-এর জন্য HTTPS (Render-এ আছে) এবং কিছু নেটওয়ার্কে TURN server প্রয়োজন হতে পারে।
- এই ZIP-এর server.js বর্তমান v3 server-এর ওপর ছোট API additions করেছে; PostgreSQL tables স্বয়ংক্রিয়ভাবে তৈরি/আপডেট হবে।
