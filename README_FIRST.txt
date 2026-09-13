BD Islamic Messenger v3

এই প্যাকেজে Register -> Login -> Home, Friend Code, real-time text, image/video/audio upload (বর্তমান 50MB request limit), profile photo, 72-hour stories, block/unblock এবং basic WebRTC signaling যুক্ত করা হয়েছে।

Render-এর DATABASE_URL এবং JWT_SECRET আগের মতোই রাখতে হবে।

গুরুত্বপূর্ণ: PostgreSQL-এর পুরোনো account নিজে থেকে মুছে দেওয়া হয়নি, যাতে ভুলে data loss না হয়। সত্যিই নতুন করে শুরু করতে চাইলে database-এর users/friendships/messages/media_files/stories data আলাদা করে পরিষ্কার করতে হবে।

2GB/3GB ভিডিওর জন্য PostgreSQL BYTEA নয়, object storage + multipart/chunk upload প্রয়োজন। এই v3-এর 50MB limit-এর বাইরে সেটি এখনও production-ready নয়।
