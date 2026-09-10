const express=require('express');
const http=require('http');
const path=require('path');
const fs=require('fs');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const multer=require('multer');
const {Pool}=require('pg');
const {Server}=require('socket.io');

const app=express(), server=http.createServer(app);
const io=new Server(server,{cors:{origin:true,credentials:true}});
const PORT=process.env.PORT||10000;
const JWT_SECRET=process.env.JWT_SECRET||'CHANGE_ME_IN_RENDER';
const DATABASE_URL=process.env.DATABASE_URL;
if(!DATABASE_URL) console.warn('DATABASE_URL is required for production.');
const pool=new Pool({connectionString:DATABASE_URL,ssl:DATABASE_URL?{rejectUnauthorized:false}:false});
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
const uploadDir=process.env.UPLOAD_DIR||path.join(__dirname,'uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({destination:uploadDir,filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(file.originalname))});
const upload=multer({storage,limits:{fileSize:50*1024*1024}});
app.use('/uploads',express.static(uploadDir));
app.use(express.static(path.join(__dirname,'public')));

async function init(){
 await pool.query(`CREATE TABLE IF NOT EXISTS users(
 id SERIAL PRIMARY KEY,name TEXT NOT NULL,country TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,
 pin_hash TEXT NOT NULL,code CHAR(4) UNIQUE NOT NULL,created_at TIMESTAMPTZ DEFAULT now())`);
 await pool.query(`CREATE TABLE IF NOT EXISTS friendships(
 user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,friend_id))`);
 await pool.query(`CREATE TABLE IF NOT EXISTS blocks(
 user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,blocked_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,blocked_id))`);
 await pool.query(`CREATE TABLE IF NOT EXISTS messages(
 id BIGSERIAL PRIMARY KEY,sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,type TEXT NOT NULL CHECK(type IN ('text','image','video')),
 body TEXT,media_url TEXT,seen BOOLEAN DEFAULT false,created_at TIMESTAMPTZ DEFAULT now())`);
}
function tokenFor(u){return jwt.sign({id:u.id,code:u.code},JWT_SECRET,{expiresIn:'30d'})}
async function auth(req,res,next){try{let h=req.headers.authorization||'';let t=h.startsWith('Bearer ')?h.slice(7):'';let p=jwt.verify(t,JWT_SECRET);let r=await pool.query('SELECT id,name,country,phone,code FROM users WHERE id=$1',[p.id]);if(!r.rowCount)throw 0;req.user=r.rows[0];next()}catch(e){res.status(401).json({error:'লগইন প্রয়োজন'})}}
async function findByCode(code){let r=await pool.query('SELECT id,name,country,phone,code FROM users WHERE code=$1',[String(code).padStart(4,'0')]);return r.rows[0]}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'BD Islamic Messenger'}));

app.post('/api/register',async(req,res)=>{
 try{
  let {name,country,phone,pin}=req.body;
  name=String(name||'').trim();phone=String(phone||'').replace(/\s+/g,'');pin=String(pin||'');
  if(!name||!phone||!/^\d{4}$/.test(pin))return res.status(400).json({error:'নাম, ফোন এবং ঠিক ৪ ডিজিটের Code দিন'});
  let ex=await pool.query('SELECT id FROM users WHERE phone=$1 OR code=$2',[phone,pin]);
  if(ex.rowCount)return res.status(409).json({error:'এই ফোন নম্বর বা User Code ইতিমধ্যে ব্যবহৃত'});
  let hash=await bcrypt.hash(pin,12);
  let r=await pool.query('INSERT INTO users(name,country,phone,pin_hash,code) VALUES($1,$2,$3,$4,$5) RETURNING id,name,country,phone,code',[name,country||'+880',phone,hash,pin]);
  res.json({token:tokenFor(r.rows[0]),user:r.rows[0]});
 }catch(e){console.error(e);res.status(500).json({error:'রেজিস্ট্রেশন ব্যর্থ'})}
});
app.post('/api/login',async(req,res)=>{
 try{
  let phone=String(req.body.phone||'').replace(/\s+/g,''),pin=String(req.body.pin||'');
  let r=await pool.query('SELECT * FROM users WHERE phone=$1',[phone]);
  if(!r.rowCount||!(await bcrypt.compare(pin,r.rows[0].pin_hash)))return res.status(401).json({error:'ফোন বা User Code ভুল'});
  let u=r.rows[0];res.json({token:tokenFor(u),user:{id:u.id,name:u.name,country:u.country,phone:u.phone,code:u.code}});
 }catch(e){res.status(500).json({error:'লগইন ব্যর্থ'})}
});
app.get('/api/me',auth,(req,res)=>res.json(req.user));

app.get('/api/friends',auth,async(req,res)=>{
 let r=await pool.query(`SELECT u.id,u.name,u.country,u.phone,u.code,
 EXISTS(SELECT 1 FROM messages m WHERE m.sender_id=u.id AND m.receiver_id=$1 AND m.seen=false) unread
 FROM users u JOIN friendships f ON f.friend_id=u.id WHERE f.user_id=$1 ORDER BY u.name`,[req.user.id]);
 let online=new Set([...io.sockets.sockets.values()].map(s=>s.userId));
 res.json(r.rows.map(x=>({...x,online:online.has(x.id)})));
});
app.post('/api/friends/add',auth,async(req,res)=>{
 try{
  let f=await findByCode(req.body.code);
  if(!f)return res.status(404).json({error:'এই User Code পাওয়া যায়নি'});
  if(f.id===req.user.id)return res.status(400).json({error:'নিজেকে Friend করা যাবে না'});
  let blocked=await pool.query('SELECT 1 FROM blocks WHERE user_id=$1 AND blocked_id=$2 OR user_id=$2 AND blocked_id=$1',[req.user.id,f.id]);
  if(blocked.rowCount)return res.status(403).json({error:'Block থাকার কারণে Friend যোগ করা যাচ্ছে না'});
  await pool.query('INSERT INTO friendships(user_id,friend_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,f.id]);
  await pool.query('INSERT INTO friendships(user_id,friend_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[f.id,req.user.id]);
  res.json({ok:true});
 }catch(e){res.status(500).json({error:'Friend যোগ করা যায়নি'})}
});
async function areFriends(a,b){let r=await pool.query('SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2',[a,b]);return !!r.rowCount}
async function blocked(a,b){let r=await pool.query('SELECT 1 FROM blocks WHERE user_id=$1 AND blocked_id=$2',[a,b]);return !!r.rowCount}
app.get('/api/chats/:code/messages',auth,async(req,res)=>{
 let f=await findByCode(req.params.code);if(!f)return res.status(404).json({error:'User পাওয়া যায়নি'});
 if(!(await areFriends(req.user.id,f.id)))return res.status(403).json({error:'আগে Friend যোগ করুন'});
 let r=await pool.query(`SELECT m.id,m.type,m.body,m.media_url "mediaUrl",m.seen,m.created_at "createdAt",u.code "senderCode"
 FROM messages m JOIN users u ON u.id=m.sender_id WHERE (m.sender_id=$1 AND m.receiver_id=$2) OR (m.sender_id=$2 AND m.receiver_id=$1)
 ORDER BY m.id DESC LIMIT 300`,[req.user.id,f.id]);
 res.json({messages:r.rows.reverse()});
});
app.post('/api/chats/:code/messages',auth,async(req,res)=>{
 let f=await findByCode(req.params.code);if(!f)return res.status(404).json({error:'User পাওয়া যায়নি'});
 if(!(await areFriends(req.user.id,f.id)))return res.status(403).json({error:'আগে Friend যোগ করুন'});
 if(await blocked(req.user.id,f.id)||await blocked(f.id,req.user.id))return res.status(403).json({error:'এই চ্যাট Block করা আছে'});
 let type=req.body.type||'text',body=String(req.body.body||''),mediaUrl=req.body.mediaUrl||null;
 if(!['text','image','video'].includes(type))return res.status(400).json({error:'অবৈধ মেসেজ'});
 if(type==='text'&&!body.trim())return res.status(400).json({error:'খালি মেসেজ'});
 let r=await pool.query(`INSERT INTO messages(sender_id,receiver_id,type,body,media_url) VALUES($1,$2,$3,$4,$5)
 RETURNING id,type,body,media_url "mediaUrl",seen,created_at "createdAt"`,[req.user.id,f.id,type,body,mediaUrl]);
 let m={...r.rows[0],senderCode:req.user.code};
 for(const s of io.sockets.sockets.values())if(s.userId===f.id)s.emit('message:new',m);
 res.json({message:m});
});
app.post('/api/chats/:code/read',auth,async(req,res)=>{
 let f=await findByCode(req.params.code);if(f)await pool.query('UPDATE messages SET seen=true WHERE sender_id=$1 AND receiver_id=$2',[f.id,req.user.id]);
 res.json({ok:true});
});
app.post('/api/block/:code',auth,async(req,res)=>{let f=await findByCode(req.params.code);if(!f)return res.status(404).json({error:'User নেই'});await pool.query('INSERT INTO blocks(user_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,f.id]);res.json({ok:true})});
app.delete('/api/block/:code',auth,async(req,res)=>{let f=await findByCode(req.params.code);if(f)await pool.query('DELETE FROM blocks WHERE user_id=$1 AND blocked_id=$2',[req.user.id,f.id]);res.json({ok:true})});

app.post('/api/upload',auth,upload.single('file'),async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'ফাইল পাওয়া যায়নি'});
 let mime=req.file.mimetype||'';
 if(!mime.startsWith('image/')&&!mime.startsWith('video/')){fs.unlinkSync(req.file.path);return res.status(400).json({error:'শুধু ছবি বা ভিডিও পাঠানো যাবে'})}
 res.json({url:'/uploads/'+req.file.filename,type:mime.startsWith('image/')?'image':'video'});
});
io.use((s,next)=>{try{s.userId=jwt.verify(s.handshake.auth.token,JWT_SECRET).id;next()}catch(e){next(new Error('unauthorized'))}});
io.on('connection',s=>{
 s.userId=Number(s.userId);
 io.emit('presence',{userId:s.userId,online:true});
 s.on('disconnect',()=>io.emit('presence',{userId:s.userId,online:false}));
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
init().then(()=>server.listen(PORT,()=>console.log('BD Islamic Messenger listening on '+PORT))).catch(e=>{console.error(e);process.exit(1)});
