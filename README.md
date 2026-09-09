# BD Islamic Messenger — Cross-device version

এই সংস্করণে chat/users আর browser `localStorage`-এ রাখা হয় না। Server database-এ রাখা হয় এবং Socket.IO দিয়ে realtime message যায়।

## চালানোর নিয়ম

1. Node.js 18+ ইনস্টল করুন।
2. এই ফোল্ডারে terminal খুলুন।
3. `npm install`
4. একটি শক্ত JWT secret সেট করুন:
   - Linux/macOS: `export JWT_SECRET="একটি-লম্বা-গোপন-চাবি"`
   - Windows PowerShell: `$env:JWT_SECRET="একটি-লম্বা-গোপন-চাবি"`
5. `npm start`
6. একই Wi‑Fi-তে পরীক্ষার জন্য অন্য ফোনে PC-এর LAN IP দিয়ে খুলুন, যেমন `http://192.168.1.10:3000`.
7. Internet-এ দুই ফোন থেকে ব্যবহার করতে হলে server-টি Render/Railway/VPS-এর মতো Node hosting-এ deploy করুন এবং সেই HTTPS address ব্যবহার করুন।

## গুরুত্বপূর্ণ
- OTP নেই, তাই ফোন নম্বর লিখলেই SIM ownership প্রমাণ হয় না।
- ৪-digit PIN মাত্র ১০,০০০ সম্ভাবনা—এটি শক্তিশালী password নয়। Production-এ rate limiting এবং পরে stronger login যোগ করা ভালো।
- `JWT_SECRET` অবশ্যই বদলাবেন।
- Image/video এখন server-এর `uploads` folder-এ যায়। বড় production app-এ object storage ব্যবহার করা ভালো।
- SQLite ছোট/মাঝারি ব্যবহারের জন্য। বড় ব্যবহারকারী হলে PostgreSQL ব্যবহার করুন।

## HopWeb
HopWeb-এ শুধু `public/index.html` রাখলে frontend দেখা যাবে, কিন্তু cross-device messaging-এর জন্য `server.js`-ও internet-এ চলতে হবে। শুধু HTML upload করলে দুই ফোনের মধ্যে সত্যিকারের chat হবে না।
