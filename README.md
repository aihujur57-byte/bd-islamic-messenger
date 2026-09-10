# BD Islamic Messenger — Lite Online

এটি cross-device online messenger-এর lightweight version।

## কী আছে
- পৃথিবীর যেকোনো জায়গা থেকে একই live server-এ account registration/login
- এক phone number = এক account
- unique 4-digit User Code
- Friend add by User Code
- realtime text message via Socket.IO
- message history in PostgreSQL
- image/video upload (প্রতি ফাইল সর্বোচ্চ 50MB)
- online/offline presence
- seen status
- block/unblock API
- responsive web UI — Chrome-এ সরাসরি চলে
- একই web app পরে Android/Play Store wrapper-এ ব্যবহার করা যাবে

## Render deployment
1. GitHub-এ এই project-এর সব file রাখুন।
2. Render Web Service বানান।
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variable:
   - `JWT_SECRET` = Render-এর Generate ব্যবহার করুন
   - `DATABASE_URL` = PostgreSQL database-এর connection string
6. PostgreSQL database যোগ করুন। Production-এ database-এর persistent storage ব্যবহার করুন।
7. Web Service-এর public HTTPS URL Chrome-এ খুলুন।

## Media storage
এই version-এর upload server-এর `uploads/` folder-এ রাখে। Production-এ durable media storage (যেমন S3-compatible object storage) ব্যবহার করা ভালো। Render filesystem restart/deploy-এর পর media হারানোর ঝুঁকি এড়াতে persistent disk/object storage প্রয়োজন।

## Security note
4-digit PIN ইচ্ছাকৃতভাবে রাখা হয়েছে কারণ requirements-এ OTP বাদ দেওয়া হয়েছে। এটি শক্তিশালী authentication নয়। Production-এ rate limiting, login attempt protection এবং সম্ভব হলে stronger passcode যোগ করা উচিত।

## Global scale
“সব ফোন” বলতে fixed two-device limit নেই। একই server/database ব্যবহার করা যত account hosting capacity ও storage অনুমতি দেয় তত account/friend/chat চলবে। বড় scale হলে PostgreSQL + object storage + CDN + multiple server instances প্রয়োজন।
