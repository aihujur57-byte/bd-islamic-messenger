BD Islamic Messenger — Islamic UI update

এই ZIP-এ নতুন Islamic Messenger frontend design-এর index.html আছে।
বর্তমান backend files ইচ্ছাকৃতভাবে এই ZIP-এ বদলানো হয়নি।

GitHub-এ ব্যবহার:
1. বর্তমান repository-এর server.js, package.json, render.yaml এবং database/backend files delete করবেন না।
2. এই ZIP থেকে শুধু index.html দিয়ে repository-এর পুরোনো index.html replace করুন।
3. Commit করুন।
4. Render নতুন deploy করলে নতুন UI দেখা যাবে।

নোট:
- UI বর্তমান project-এর /api/login, /api/register, /api/me, /api/friends,
  /api/friends/add, /api/chats/:code/messages, /api/upload, /api/profile,
  /api/block/:code এবং Socket.IO event-এর সাথে মিল রেখে তৈরি।
- বর্তমান server.js-এ upload route শুধু image/video নেয় এবং 50MB-এর বর্তমান frontend limit রাখা হয়েছে।
- Groups, Stories 72-hour lifecycle, calls এবং 2GB/3GB chunked/object storage-এর মতো বড় production features-এর জন্য backend changes আলাদাভাবে করতে হবে।
