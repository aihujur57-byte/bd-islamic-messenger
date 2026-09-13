const chats=[
  {name:"আমার সাথে নিজে",letter:"☪",preview:"আসসালামু আলাইকুম, কেমন আছেন?",time:"7:18 AM",unread:0},
  {name:"ইসলামিক জ্ঞান",letter:"ك",preview:"আজকের বিষয়: নামাজের গুরুত্ব",time:"6:45 AM",unread:3},
  {name:"দাওয়াহ গ্রুপ",letter:"👥",preview:"মাওলানা রফিক: সবাই আজ রাত ৮টায় অনলাইনে...",time:"6:32 AM",unread:12},
  {name:"আব্দুল্লাহ ভাই",letter:"ع",preview:"ঠিক আছে ভাই, ইনশাআল্লাহ",time:"5:50 AM",unread:0},
  {name:"কুরআন তিলাওয়াত",letter:"📖",preview:"🔊 অডিও বার্তা (2:34)",time:"5:20 AM",unread:0},
  {name:"মুহাম্মদ রাহাত",letter:"ر",preview:"জাযাকাল্লাহ খাইর",time:"Yesterday",unread:0},
  {name:"মসজিদ কমিউনিটি",letter:"م",preview:"নতুন নোটিশ: আগামী শুক্রবারের জুমার খুতবা...",time:"Yesterday",unread:5},
  {name:"রাফিয়া আপা",letter:"●",preview:"আসসালামু আলাইকুম, কেমন আছেন?",time:"Yesterday",unread:0},
  {name:"বাংলা ইসলামিক স্টাডি",letter:"👥",preview:"আপনি গ্রুপে যোগ দিয়েছেন",time:"Fri",unread:0}
];
let activeChat=null;

function renderChats(list=chats){
  const el=document.getElementById('chat-list');
  el.innerHTML=list.map((c,i)=>`<button class="chat-item" onclick="openChat(${i})">
    <div class="avatar">${c.letter}${i===3?'<span class="online-dot"></span>':''}</div>
    <div class="chat-body"><div class="chat-name"><span>${c.name}</span><span class="chat-time">${c.time}</span></div>
    <div class="chat-preview">${i<2?'✓✓ ':''}${c.preview}</div></div>
    ${c.unread?`<span class="unread">${c.unread}</span>`:''}
  </button>`).join('');
}
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
  hideMenu();
}
function focusSearch(){showPage('chats');document.getElementById('search').focus()}
function filterChats(q){q=q.trim().toLowerCase();renderChats(chats.filter(c=>c.name.toLowerCase().includes(q)||c.preview.toLowerCase().includes(q)))}
function openChat(i){
  activeChat=chats[i];document.getElementById('chat-name').textContent=activeChat.name;
  document.getElementById('chat-avatar').textContent=activeChat.letter;
  const messages=document.getElementById('messages');
  messages.innerHTML=`<div class="msg out">আসসালামু আলাইকুম, কেমন আছেন?<time>7:18 AM ✓✓</time></div>
  <div class="msg in">ওয়ালাইকুম আসসালাম, আমি ভালো আছি ভাই। আপনি কেমন আছেন?<time>7:20 AM</time></div>
  <div class="msg out">আলহামদুলিল্লাহ, আমিও ভালো আছি।<time>7:21 AM ✓✓</time></div>
  <div class="msg in">আপনার কাছে একটি প্রশ্ন ছিল, সময় পেলে একটু বলবেন।<time>7:22 AM</time></div>`;
  document.getElementById('chat-modal').classList.remove('hidden');
}
function closeChat(){document.getElementById('chat-modal').classList.add('hidden')}
function sendMessage(){
  const input=document.getElementById('message-input'),text=input.value.trim();if(!text)return;
  const m=document.createElement('div');m.className='msg out';m.innerHTML=escapeHtml(text)+'<time>এখন ✓✓</time>';
  document.getElementById('messages').appendChild(m);input.value='';document.getElementById('messages').scrollTop=999999;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function openAddFriend(){hideMenu();document.getElementById('friend-modal').classList.remove('hidden');setTimeout(()=>document.getElementById('secret-code').focus(),50)}
function closeFriend(){document.getElementById('friend-modal').classList.add('hidden')}
function addFriend(){
  const code=document.getElementById('secret-code').value.trim();
  if(!/^\d{4}$/.test(code)){alert('৪ সংখ্যার Secret Code লিখুন।');return}
  alert('Secret Code পাওয়া গেছে। Backend API সংযোগ করলে এখান থেকেই বাস্তবে Friend Add হবে।');closeFriend()
}
function toggleMenu(e){e.stopPropagation();document.getElementById('menu').classList.toggle('hidden')}
function hideMenu(){document.getElementById('menu').classList.add('hidden')}
function openSetting(name){alert(name+' সেটিংসের UI প্রস্তুত। Backend সংযোগের পর এর বাস্তব সেটিংস চালু করা হবে।')}
document.addEventListener('click',e=>{if(!e.target.closest('.menu')&&!e.target.closest('.top-actions'))hideMenu()});
renderChats();
