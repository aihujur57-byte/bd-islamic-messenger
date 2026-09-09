const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const sqlite3=require('sqlite3').verbose();
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const multer=require('multer');
const path=require('path'),fs=require('fs'),crypto=require('crypto');

const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET||'CHANGE_THIS_SECRET_IN_PRODUCTION';
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));
const uploadDir=path.join(__dirname,'uploads'); if(!fs.existsSync(uploadDir))fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({dest:uploadDir,limits:{fileSize:50*1024*1024}});

const db=new sqlite3.Database(process.env.DB_FILE||'messenger.db');
db.serialize(()=>{
 db.run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,country TEXT,friend_code TEXT UNIQUE NOT NULL,pin_hash TEXT NOT NULL,created_at TEXT NOT NULL,last_seen TEXT,online INTEGER DEFAULT 0)`);
 db.run(`CREATE TABLE IF NOT EXISTS friendships(user_id INTEGER NOT NULL,friend_id INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,friend_id))`);
 db.run(`CREATE TABLE IF NOT EXISTS blocks(blocker_id INTEGER NOT NULL,blocked_id INTEGER NOT NULL,UNIQUE(blocker_id,blocked_id))`);
 db.run(`CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender_id INTEGER NOT NULL,receiver_id INTEGER NOT NULL,type TEXT NOT NULL,text TEXT,media_url TEXT,created_at TEXT NOT NULL,seen_at TEXT)`);
});
const run=(sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res(this)}));
const get=(sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r)));
const all=(sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));

function normPhone(p){return String(p||'').replace(/[^\d+]/g,'').replace(/^00/,'+')}
function sign(u){return jwt.sign({id:u.id},JWT_SECRET,{expiresIn:'30d'})}
async function auth(req,res,next){try{let h=req.headers.authorization||'';let t=h.startsWith('Bearer ')?h.slice(7):'';let x=jwt.verify(t,JWT_SECRET);let u=await get('SELECT * FROM users WHERE id=?',[x.id]);if(!u)return res.status(401).json({error:'Login required'});req.user=u;next()}catch(e){res.status(401).json({error:'Login required'})}}

app.post('/api/register',async(req,res)=>{
 try{
  let {name,phone,country,pin}=req.body; name=String(name||'').trim();phone=normPhone(phone);pin=String(pin||'');
  if(!name||!phone||!/^\d{4}$/.test(pin))return res.status(400).json({error:'নাম, ফোন এবং ৪ সংখ্যার PIN দিন'});
  if(await get('SELECT id FROM users WHERE phone=?',[phone]))return res.status(409).json({error:'এই ফোন নম্বরে অ্যাকাউন্ট আছে'});
  if(await get('SELECT id FROM users WHERE friend_code=?',[pin]))return res.status(409).json({error:'এই User Code ইতিমধ্যে ব্যবহার হয়েছে'});
  let hash=await bcrypt.hash(pin,12),now=new Date().toISOString();
  let r=await run('INSERT INTO users(name,phone,country,friend_code,pin_hash,created_at,last_seen) VALUES(?,?,?,?,?,?,?)',[name,phone,country,pin,hash,now,now]);
  let u=await get('SELECT * FROM users WHERE id=?',[r.lastID]);res.json({token:sign(u),user:safe(u)});
 }catch(e){res.status(500).json({error:'Registration failed'})}
});
app.post('/api/login',async(req,res)=>{
 try{
  let phone=normPhone(req.body.phone),pin=String(req.body.pin||''),u=await get('SELECT * FROM users WHERE phone=?',[phone]);
  if(!u||!(await bcrypt.compare(pin,u.pin_hash)))return res.status(401).json({error:'ফোন বা PIN সঠিক নয়'});
  await run('UPDATE users SET last_seen=? WHERE id=?',[new Date().toISOString(),u.id]);res.json({token:sign(u),user:safe(u)});
 }catch(e){res.status(500).json({error:'Login failed'})}
});
app.get('/api/me',auth,(req,res)=>res.json({user:safe(req.user)}));
app.get('/api/accounts',auth,async(req,res)=>res.json({accounts:[safe(req.user)]}));
app.get('/api/friends',auth,async(req,res)=>{
 let rows=await all(`SELECT u.id,u.name,u.phone,u.country,u.friend_code,u.online,u.last_seen,
  EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id=? AND b.blocked_id=u.id) blocked
  FROM users u JOIN friendships f ON f.friend_id=u.id WHERE f.user_id=? ORDER BY u.name`,[req.user.id,req.user.id]);
 res.json({friends:rows});
});
app.post('/api/friends/add',auth,async(req,res)=>{
 let code=String(req.body.friend_code||'').trim();if(!/^\d{4}$/.test(code))return res.status(400).json({error:'৪ সংখ্যার User Code দিন'});
 let f=await get('SELECT * FROM users WHERE friend_code=?',[code]);if(!f)return res.status(404).json({error:'এই User Code পাওয়া যায়নি'});
 if(f.id===req.user.id)return res.status(400).json({error:'নিজেকে বন্ধু করা যাবে না'});
 let blocked=await get('SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',[req.user.id,f.id,f.id,req.user.id]);
 if(blocked)return res.status(403).json({error:'Block করা আছে'});
 await run('INSERT OR IGNORE INTO friendships VALUES(?,?,?)',[req.user.id,f.id,new Date().toISOString()]);
 await run('INSERT OR IGNORE INTO friendships VALUES(?,?,?)',[f.id,req.user.id,new Date().toISOString()]);
 res.json({message:`${f.name} এখন আপনার বন্ধু`});
});
app.get('/api/chats/:code/messages',auth,async(req,res)=>{
 let f=await get('SELECT * FROM users WHERE friend_code=?',[req.params.code]);if(!f)return res.status(404).json({error:'User not found'});
 let blocked=await get('SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',[req.user.id,f.id,f.id,req.user.id]);
 if(blocked)return res.status(403).json({error:'এই ব্যবহারকারী Block করা আছে'});
 let ms=await all('SELECT * FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY id',[req.user.id,f.id,f.id,req.user.id]);
 res.json({messages:ms});
});
app.post('/api/chats/:code/read',auth,async(req,res)=>{
 let f=await get('SELECT id FROM users WHERE friend_code=?',[req.params.code]);if(f)await run('UPDATE messages SET seen_at=? WHERE sender_id=? AND receiver_id=? AND seen_at IS NULL',[new Date().toISOString(),f.id,req.user.id]);
 res.json({ok:true});
});
app.post('/api/chats/:code/messages',auth,async(req,res)=>{
 let f=await get('SELECT * FROM users WHERE friend_code=?',[req.params.code]);if(!f)return res.status(404).json({error:'User not found'});
 let friendship=await get('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?',[req.user.id,f.id]);if(!friendship)return res.status(403).json({error:'আগে বন্ধু যোগ করুন'});
 let blocked=await get('SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',[req.user.id,f.id,f.id,req.user.id]);if(blocked)return res.status(403).json({error:'Block করা আছে'});
 let type=req.body.type||'text'; if(!['text','image','video'].includes(type))return res.status(400).json({error:'Invalid message type'});
 let m={sender_id:req.user.id,receiver_id:f.id,type,text:String(req.body.text||''),media_url:req.body.media_url||'',created_at:new Date().toISOString()};
 let r=await run('INSERT INTO messages(sender_id,receiver_id,type,text,media_url,created_at) VALUES(?,?,?,?,?,?)',[m.sender_id,m.receiver_id,m.type,m.text,m.media_url,m.created_at]);
 m.id=r.lastID;m.seen_at=null;io.to('user:'+f.id).emit('message:new',m);res.json({message:m});
});
app.post('/api/block/:code',auth,async(req,res)=>{
 let f=await get('SELECT id FROM users WHERE friend_code=?',[req.params.code]);if(!f)return res.status(404).json({error:'User not found'});
 await run('INSERT OR IGNORE INTO blocks VALUES(?,?)',[req.user.id,f.id]);res.json({message:'User blocked'});
});
app.delete('/api/block/:code',auth,async(req,res)=>{
 let f=await get('SELECT id FROM users WHERE friend_code=?',[req.params.code]);if(f)await run('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?',[req.user.id,f.id]);res.json({message:'User unblocked'});
});
app.post('/api/upload',auth,upload.single('file'),(req,res)=>{
 if(!req.file)return res.status(400).json({error:'File missing'});
 let ext=path.extname(req.file.originalname).toLowerCase();let name=crypto.randomBytes(16).toString('hex')+ext;
 fs.renameSync(req.file.path,path.join(uploadDir,name));res.json({url:'/uploads/'+name});
});
app.use('/uploads',express.static(uploadDir));
function safe(u){return {id:u.id,name:u.name,phone:u.phone,country:u.country,friend_code:u.friend_code,online:!!u.online,last_seen:u.last_seen}}
io.use((socket,next)=>{try{let x=jwt.verify(socket.handshake.auth?.token||'',JWT_SECRET);socket.userId=x.id;next()}catch(e){next(new Error('unauthorized'))}});
io.on('connection',async s=>{
 s.join('user:'+s.userId);await run('UPDATE users SET online=1,last_seen=? WHERE id=?',[new Date().toISOString(),s.userId]);io.emit('presence',{user_id:s.userId,online:true});
 s.on('disconnect',async()=>{await run('UPDATE users SET online=0,last_seen=? WHERE id=?',[new Date().toISOString(),s.userId]);io.emit('presence',{user_id:s.userId,online:false})});
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(PORT,()=>console.log('BD Islamic Messenger server running on '+PORT));
