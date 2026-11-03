const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});
const E=(m,s=400)=>J({e:m},s),enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const PRE=['Hi! 👋','Good game! 🎉','Want to play?','Nice move!','Thanks!','Bye! 👋'],INV=/^INVITE:chess:dhb[a-z0-9]{3,8}$/;
async function hash(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
async function tok(db,id,u){const t=crypto.randomUUID()+crypto.randomUUID();await db.prepare('insert into sessions(token,uid) values(?,?)').bind(t,id).run();return{token:t,track:u.track,name:u.name}}
export default{async fetch(r,env){
if(r.method=='OPTIONS')return J({});
const db=env.DB,U=new URL(r.url),p=U.pathname,q=U.searchParams;let b={};if(r.method=='POST')try{b=await r.json()}catch{}
if(p=='/api/lb'){const x=await db.prepare('select id,name,av,honey,track from users order by honey desc limit 50').all();return J({l:x.results.map(u=>({n:u.track=='kid'?'Bee #'+u.id:u.name,av:u.av,h:u.honey}))})}
if(p=='/api/signup'){const n=String(b.u||'').trim(),a=new Date().getFullYear()-(+b.y);if(!/^[A-Za-z0-9_]{3,16}$/.test(n)||String(b.pw||'').length<6||!(a>=5&&a<=110))return E('Use a 3-16 letter/number username, a 6+ character password and a valid birth year');
const tr=a>=18?'adult':a>=13?'teen':'kid',salt=crypto.randomUUID();try{const x=await db.prepare('insert into users(name,salt,hash,av,track,honey) values(?,?,?,?,?,0)').bind(n.toLowerCase(),salt,await hash(b.pw,salt),String(b.av||'🐝').slice(0,4),tr).run();return J(await tok(db,x.meta.last_row_id,{track:tr,name:n.toLowerCase()}))}catch{return E('That username is taken',409)}}
if(p=='/api/login'){const u=await db.prepare('select * from users where name=?').bind(String(b.u||'').toLowerCase()).first();if(!u||await hash(String(b.pw||''),u.salt)!=u.hash)return E('Wrong username or password',401);return J(await tok(db,u.id,u))}
const t=(r.headers.get('authorization')||'').slice(7),me=t&&await db.prepare('select u.* from sessions s join users u on u.id=s.uid where s.token=?').bind(t).first();if(!me)return E('Please log in',401);
const by=n=>db.prepare('select * from users where name=?').bind(String(n||'').toLowerCase()).first();
const isF=o=>db.prepare("select 1 x from friends where st='ok' and ((a=? and b=?) or (a=? and b=?))").bind(me.id,o,o,me.id).first();
if(p=='/api/sync'){await db.prepare('update users set honey=max(honey,min(?,honey+300)) where id=?').bind(Math.max(0,Math.floor(+b.honey||0)),me.id).run();return J({ok:1})}
if(p=='/api/friends'){const x=await db.prepare('select u.name n,u.av,u.honey h,f.st,(f.a=?) mine from friends f join users u on u.id=(case when f.a=? then f.b else f.a end) where f.a=? or f.b=?').bind(me.id,me.id,me.id,me.id).all();return J({f:x.results.map(f=>({...f,mine:!!f.mine}))})}
if(p=='/api/friend'){const o=await by(b.to);if(!o||o.id==me.id||o.track!=me.track)return E('You can’t send a request to that user');const rv=await db.prepare('select st from friends where a=? and b=?').bind(o.id,me.id).first();
if(rv)await db.prepare("update friends set st='ok' where a=? and b=?").bind(o.id,me.id).run();else await db.prepare("insert or ignore into friends(a,b,st) values(?,?,'p')").bind(me.id,o.id).run();return J({ok:1})}
if(p=='/api/accept'){const o=await by(b.from);if(o)await db.prepare("update friends set st='ok' where a=? and b=? and st='p'").bind(o.id,me.id).run();return J({ok:1})}
if(p=='/api/remove'){const o=await by(b.who);if(o)await db.prepare('delete from friends where (a=? and b=?) or (a=? and b=?)').bind(me.id,o.id,o.id,me.id).run();return J({ok:1})}
if(p=='/api/chat'){const o=await by(r.method=='GET'?q.get('with'):b.to);if(!o||!await isF(o.id))return E('You can only chat with friends');
if(r.method=='GET'){const x=await db.prepare('select id,frm,body from msgs where ((frm=? and tto=?) or (frm=? and tto=?)) and id>? order by id limit 50').bind(me.id,o.id,o.id,me.id,+q.get('since')||0).all();return J({m:x.results.map(m=>({id:m.id,me:m.frm==me.id,body:m.body}))})}
const s=String(b.body||'').trim().slice(0,200);if(!(INV.test(s)||(me.track=='kid'?PRE.includes(s):s&&!/https?:|www\./i.test(s))))return E('Message not allowed');
const n=await db.prepare('select count(*) c from msgs where frm=? and ts>?').bind(me.id,Date.now()-10000).first();if(n.c>5)return E('Slow down a little',429);
await db.prepare('insert into msgs(frm,tto,body,ts) values(?,?,?,?)').bind(me.id,o.id,s,Date.now()).run();return J({ok:1})}
return E('Not found',404)}}
