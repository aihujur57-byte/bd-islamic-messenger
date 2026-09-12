# BD Islamic Messenger – Persistent Media Fix

This version stores uploaded images/videos in PostgreSQL (`media_files`) instead of Render's temporary filesystem.

It also stores the profile photo URL in `users.avatar_url`, keeps Profile inside the ☰ Menu, and serves media from `/api/media/:id`.

Render:
- Build: `npm install`
- Start: `npm start`
- Requires existing `DATABASE_URL` and `JWT_SECRET` environment variables.

Note: old media files that were already lost from Render cannot be recovered. New uploads are persistent in PostgreSQL.
