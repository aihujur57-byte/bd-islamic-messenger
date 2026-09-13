import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const seedChats=[
 {id:1,name:'Abdullah Rahman',code:'4827',msg:'Assalamu Alaikum',time:'10:42 AM',online:true,avatar:'AR'},
 {id:2,name:'Md. Hasan',code:'7314',msg:'See you soon In Sha Allah',time:'9:18 AM',online:false,avatar:'MH'},
 {id:3,name:'Ayesha Karim',code:'2659',msg:'Photo',time:'Yesterday',online:true,avatar:'AK'}
];

function Logo(){return <div className="logoMark">☪</div>}
function Splash(){return <div className="splash"><Logo/><h1>Islamic Messenger</h1><p>Connect • Share • Remember</p></div>}

function Auth({onLogin}) {
 const [mode,setMode]=useState('login');
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [pin,setPin]=useState('');
 const submit=e=>{e.preventDefault(); if(phone&&pin) onLogin({name:name||'Islamic Messenger User',phone,pin,code:'4827'});};
 return <div className="auth"><div className="authCard"><Logo/><h1>Islamic Messenger</h1>
 <p className="muted">{mode==='login'?'Welcome back':'Create your account'}</p>
 <form onSubmit={submit}>
 {mode==='register'&&<><input placeholder="First Name" value={name} onChange={e=>setName(e.target.value)} required/><input placeholder="Last Name"/></>}
 {mode==='register'&&<select><option>🇧🇩 Bangladesh</option><option>🇺🇸 United States</option><option>🇬🇧 United Kingdom</option><option>🇸🇦 Saudi Arabia</option><option>🇦🇪 United Arab Emirates</option><option>🌍 Other country</option></select>}
 <input placeholder="Phone number" value={phone} onChange={e=>setPhone(e.target.value)} required/>
 <input inputMode="numeric" maxLength="4" placeholder="4-digit PIN" value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,''))} required/>
 <button className="primary">{mode==='login'?'Login':'Register'}</button>
 </form>
 <button className="link" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Create new account':'Already have an account? Login'}</button>
 </div></div>
}

function Avatar({text,online}){return <span className="avatar">{text}<i className={online?'online':''}/></span>}

function Chat({chat,onBack}){
 const [messages,setMessages]=useState([{id:1,from:'them',text:'Assalamu Alaikum 🌙',time:'10:40 AM'},{id:2,from:'me',text:'Wa Alaikum Assalam!',time:'10:41 AM'}]);
 const [text,setText]=useState(''); const [selected,setSelected]=useState(null);
 const send=e=>{e.preventDefault();if(!text.trim())return;setMessages(m=>[...m,{id:Date.now(),from:'me',text,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}]);setText('')};
 const del=id=>setMessages(m=>m.filter(x=>x.id!==id));
 return <div className="screen chatScreen">
 <header className="top"><button onClick={onBack}>←</button><Avatar text={chat.avatar} online={chat.online}/><div className="title"><b>{chat.name}</b><small>{chat.online?'Online':'Last seen recently'}</small></div><button>📞</button><button>📹</button><button>⋮</button></header>
 <main className="messages">{messages.map(m=><div key={m.id} className={'bubble '+m.from} onContextMenu={e=>{e.preventDefault();setSelected(m.id)}}>{m.text}<small>{m.time}{m.from==='me'?'  ✓✓':''}</small>{selected===m.id&&<div className="messageMenu"><button>↩ Reply</button>{m.from==='me'&&<button onClick={()=>{setText(m.text);setSelected(null)}}>✎ Edit</button>}<button onClick={()=>del(m.id)}>🗑 Delete</button><button onClick={()=>setSelected(null)}>Copy</button></div>}</div>)}</main>
 <form className="composer" onSubmit={send}><button type="button">😊</button><input value={text} onChange={e=>setText(e.target.value)} placeholder="Message..."/><button type="button">＋</button><button type="button">🎤</button><button className="send">➤</button></form>
 </div>
}

function App(){
 const [splash,setSplash]=useState(true),[user,setUser]=useState(null),[page,setPage]=useState('chats'),[chat,setChat]=useState(null);
 const [accounts,setAccounts]=useState(()=>JSON.parse(localStorage.getItem('im_accounts')||'[]'));
 useEffect(()=>{const t=setTimeout(()=>{setSplash(false);const a=JSON.parse(localStorage.getItem('im_active')||'null');if(a)setUser(a)},1200);return()=>clearTimeout(t)},[]);
 const login=u=>{const a=[...accounts.filter(x=>x.phone!==u.phone),u];setAccounts(a);localStorage.setItem('im_accounts',JSON.stringify(a));localStorage.setItem('im_active',JSON.stringify(u));setUser(u)};
 if(splash)return <Splash/>; if(!user)return <Auth onLogin={login}/>; if(chat)return <Chat chat={chat} onBack={()=>setChat(null)}/>;
 return <div className="app"><header className="brand"><div><Logo/><div><b>Islamic Messenger</b><small>Peaceful • Private • Connected</small></div></div><button onClick={()=>setPage('profile')}>◯</button></header>
 <main className="content">
 {page==='chats'&&<><div className="heading"><h2>Chats</h2><button className="gold" onClick={()=>alert('Search ready')}>⌕</button></div><input className="search" placeholder="Search chats"/>{seedChats.map(c=><div className="chatItem" key={c.id} onClick={()=>setChat(c)}><Avatar text={c.avatar} online={c.online}/><div><b>{c.name}</b><p>{c.msg}</p></div><time>{c.time}</time></div>)}</>}
 {page==='stories'&&<><h2>Stories</h2><div className="storyGrid"><div className="story add">＋<small>Add Story</small></div>{seedChats.map(c=><div className="story" key={c.id}><Avatar text={c.avatar} online={false}/><small>{c.name.split(' ')[0]}</small></div>)}</div><div className="info">Stories expire automatically after 72 hours. Photo/video stories supported.</div></>}
 {page==='friends'&&<><div className="heading"><h2>Friends</h2><button className="primary small" onClick={()=>alert('Enter a 4-digit Friend Code')}>＋ Add Friend</button></div>{seedChats.map(c=><div className="friend"><Avatar text={c.avatar} online={c.online}/><div><b>{c.name}</b><p>Friend Code: {c.code}</p></div><button onClick={()=>setChat(c)}>Chat</button></div>)}</>}
 {page==='profile'&&<><div className="profile"><Avatar text={(user.name||'IM').slice(0,2).toUpperCase()}/><h2>{user.name}</h2><p>{user.phone}</p><div className="code">Friend Code <b>{user.code}</b></div></div><section className="settings">{['Edit Profile','Account','Privacy','Security','Notifications','Chats','Storage & Data','Blocked Users','Help & About'].map(x=><button key={x}>{x}<span>›</span></button>)}<button className="danger" onClick={()=>{localStorage.removeItem('im_active');setUser(null)}}>Logout</button></section></>}
 </main>
 <nav><button className={page==='chats'?'active':''} onClick={()=>setPage('chats')}>💬<small>Chats</small></button><button className={page==='stories'?'active':''} onClick={()=>setPage('stories')}>◉<small>Stories</small></button><button className={page==='friends'?'active':''} onClick={()=>setPage('friends')}>👥<small>Friends</small></button><button className={page==='profile'?'active':''} onClick={()=>setPage('profile')}>👤<small>Profile</small></button></nav>
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);
