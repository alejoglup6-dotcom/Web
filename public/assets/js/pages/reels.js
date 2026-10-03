// Página: Reels (/reels) · videos de la comunidad a pantalla completa: deslizar para ver más, me gusta, comentarios, compartir, guardar y •••
// Parámetros: ?r=id (abre ese reel primero) · ?u=Nombre (solo los de ese jugador) · ?saved=1 (mis guardados) · ?c=1 (abre los comentarios) · ?nuevo=1 (crear reel)
Object.assign(EN,{"Reels":"Reels","Reels de":"Reels by","Crear reel":"Create reel","Elegir video":"Choose a video","Describe tu reel…":"Describe your reel…","Compartir":"Share","Guardar":"Save","Guardado":"Saved","Quitar de guardados":"Remove from saved","Copiar enlace":"Copy link","Ver perfil":"View profile","Eliminar reel":"Delete reel","¿Eliminar este reel?":"Delete this reel?","Agregar":"Add","Aún no hay reels.":"No reels yet.","¡Sube el primero!":"Upload the first one!","Comentarios":"Comments","Escribe un comentario…":"Write a comment…","Sé el primero en comentar.":"Be the first to comment.","Subiendo video":"Uploading video","Reel publicado":"Reel published","Activar sonido":"Unmute","Silenciar":"Mute","Ver más":"See more","Usa un video MP4":"Use an MP4 video","El video pesa demasiado":"The video is too large","No pude leer ese video":"I couldn't read that video","El video dura más de":"The video is longer than","segundos":"seconds","Leyendo video…":"Reading video…","Volver":"Back"});
document.body.classList.add("rl-pg");
const QS=new URLSearchParams(location.search),RQ={u:/^\w{1,24}$/.test(QS.get("u")||"")?QS.get("u"):"",saved:QS.get("saved")==="1",start:Number(QS.get("r"))||0};
let RL=[],RMORE=true,RLOAD=false,RACT=-1,RMUTE=true,RIO=null,RTAP=0,RTT=0,RCOM=0;
const rlq=()=>(RQ.u?"&author="+encodeURIComponent(RQ.u):"")+(RQ.saved?"&saved=1":"");
async function rlFetch(){if(RLOAD||!RMORE)return;RLOAD=true;const last=RL.at(-1);
 const r=await api("/reels?n=8"+rlq()+(last?"&before="+last.id:RQ.start?"&start="+RQ.start:""));RLOAD=false;
 if(!r.ok){toast(r.d.error||"Error");return}
 const nu=r.d.items.filter(x=>!RL.some(y=>y.id===x.id));RMORE=r.d.more;const k=RL.length;RL.push(...nu);
 const box=$("#rls");if(!box)return;$("#rle")?.remove();
 if(!RL.length){box.innerHTML=rlEmpty();return}
 box.insertAdjacentHTML("beforeend",nu.map((x,i)=>rlItem(x,k+i)).join(""));
 box.querySelectorAll(".rl:not([data-o])").forEach(el=>{el.dataset.o=1;RIO.observe(el)})}
const rlEmpty=()=>`<div class="rle" id="rle">${ic("videos")}<h3>${t("Aún no hay reels.")}</h3><p class="m">${t("¡Sube el primero!")}</p>${U?`<button class="btn p" type="button" onclick="nuevoReel()">${ic("mas")} ${t("Crear reel")}</button>`:""}</div>`;
function rlItem(r,i){const m=r.media[0]||{};
 return `<section class="rl" id="rl${i}" data-i="${i}" aria-label="Reel ${i+1}">
 <video class="rlv" playsinline loop preload="none" muted poster="${m.thumb?"/media/"+m.thumb:""}" data-src="/media/${m.id}"></video>
 <div class="rlt" onclick="rlTap(${i})"></div><span class="rlpp" aria-hidden="true">${ic("play")}</span><span class="rlh" aria-hidden="true">${ic("like")}</span>
 <div class="rlr">
  <button type="button" id="rk${i}" class="${r.mine>0?"on":""}" onclick="rlLike(${i})" aria-label="${t("Me gusta")}">${ic("like")}<span>${cnt(r.likes)}</span></button>
  <button type="button" id="rc${i}" onclick="rlCom(${i})" aria-label="${t("Comentarios")}">${ic("discord_comentarios")}<span>${cnt(r.comments)}</span></button>
  <button type="button" onclick="rlShare(${i})" aria-label="${t("Compartir")}">${ic("compartir_vincular")}<span>${t("Compartir")}</span></button>
  <button type="button" id="rs${i}" class="${r.saved>0?"on":""}" onclick="rlSave(${i})" aria-label="${t("Guardar")}">${ic("guardar")}<span>${cnt(r.saves)}</span></button>
  <button type="button" onclick="rlMenu(${i})" aria-label="${t("Opciones")}">${ic("puntos")}</button>
 </div>
 <div class="rlb"><div class="rla"><a href="${lk(r.author)}">${skin(r.skin,r.author)}<b>${nom(r.author)}</b></a>${U&&r.fstate==="none"?`<button type="button" class="rlf" id="rf${i}" onclick="rlAdd(${i})">${t("Agregar")}</button>`:""}</div>
 ${r.body?`<p class="rlcap" onclick="this.classList.toggle('on')">${linkM(r.body)}</p>`:""}<small>${ago(r.created_at)}</small></div>
 <div class="rlpb"><i id="rp${i}"></i></div></section>`}
async function pg_reels(){RL=[];RMORE=true;RLOAD=false;RACT=-1;RIO?.disconnect();
 const tit=RQ.saved?t("Guardados"):RQ.u?`${t("Reels de")} ${nom(RQ.u)}`:t("Reels");window.PTITLE=tit.replace(/<[^>]*>/g,"");
 setTimeout(rlInit);
 return `<div class="rlh2"><button class="rlib hb2" type="button" onclick="document.getElementById('dr').classList.add('on')" aria-label="${t("Menú")}">${ic("menu_hamburguesa")}</button><a class="rlib bk" href="/" aria-label="${t("Volver")}">‹</a><h1>${tit}</h1><span class="sp"></span>
 <button class="rlib" id="rlmu" type="button" onclick="rlMute()" aria-label="${t("Activar sonido")}">${ic("silencio")}</button>${U?`<button class="rlib" type="button" onclick="nuevoReel()" aria-label="${t("Crear reel")}">${ic("mas")}</button><a class="rlib" href="/perfil?tab=reels" aria-label="${t("Mi perfil")}">${ic("usuario_perfil")}</a>`:`<button class="rlib" type="button" onclick="login()" aria-label="${t("Iniciar sesión")}">${ic("usuario_perfil")}</button>`}</div>
 <div class="rls" id="rls"></div>`}
async function rlInit(){
 if(!$("#rlc"))document.body.insertAdjacentHTML("beforeend",`<div class="rlc" id="rlc" aria-hidden="true"></div>`); // fuera de #main: así queda encima de la barra inferior
 RIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>=.6)rlSet(Number(e.target.dataset.i))}),{root:$("#rls"),threshold:[.6]});
 await rlFetch();
 if(QS.get("c")==="1"&&RL.length)rlCom(0);
 if(QS.get("nuevo")==="1"&&U)nuevoReel()}
// reel activo: reproduce ese, carga el video de los vecinos y pausa el resto
function rlSet(i){if(i===RACT)return;RACT=i;
 document.querySelectorAll("#rls .rl").forEach(el=>{const k=Number(el.dataset.i),v=el.querySelector("video");
  if(Math.abs(k-i)<=1&&!v.src)v.src=v.dataset.src,v.preload=k===i?"auto":"metadata";
  if(k!==i){v.pause();el.classList.remove("pz")}});
 const v=$("#rl"+i+" video");if(v){v.muted=RMUTE;v.currentTime=0;v.play().catch(()=>{if(!v.muted){RMUTE=true;v.muted=true;rlMuteIc();v.play().catch(()=>{})}});v.ontimeupdate=()=>{const p=$("#rp"+i);if(p&&v.duration)p.style.width=v.currentTime/v.duration*100+"%"}}
 const r=RL[i];if(r)try{const u=new URL(location.href);u.searchParams.set("r",r.id);u.searchParams.delete("c");u.searchParams.delete("nuevo");history.replaceState(null,"",u)}catch{}
 if(i>=RL.length-3)rlFetch()}
function rlMuteIc(){const b=$("#rlmu");if(b){b.innerHTML=ic(RMUTE?"silencio":"sonido");b.setAttribute("aria-label",t(RMUTE?"Activar sonido":"Silenciar"))}}
function rlMute(){RMUTE=!RMUTE;document.querySelectorAll("#rls video").forEach(v=>v.muted=RMUTE);rlMuteIc()}
// un toque pausa/reanuda; dos toques seguidos dan me gusta
function rlTap(i){const now=Date.now();clearTimeout(RTT);
 if(now-RTAP<300){RTAP=0;const el=$("#rl"+i);el.classList.remove("hrt");void el.offsetWidth;el.classList.add("hrt");if(!(RL[i].mine>0))rlLike(i);return}
 RTAP=now;RTT=setTimeout(()=>{const el=$("#rl"+i),v=el.querySelector("video");if(RMUTE&&!v.paused&&!el.dataset.u){el.dataset.u=1;rlMute();return} // el primer toque activa el sonido
  if(v.paused){v.play().catch(()=>{});el.classList.remove("pz")}else{v.pause();el.classList.add("pz")}},300)}
async function rlLike(i){if(!U)return login();const r=RL[i],x=await api("/posts/"+r.id+"/like",{method:"POST",body:{}});if(!x.ok)return toast(x.d.error||"Error");
 r.mine=x.d.liked?1:0;r.likes=x.d.likes;const b=$("#rk"+i);b.classList.toggle("on",x.d.liked);b.querySelector("span").textContent=cnt(r.likes)}
async function rlSave(i){if(!U)return login();const r=RL[i],x=await api("/posts/"+r.id+"/save",{method:"POST",body:{}});if(!x.ok)return toast(x.d.error||"Error");
 r.saved=x.d.saved?1:0;r.saves=x.d.saves;const b=$("#rs"+i);b.classList.toggle("on",x.d.saved);b.querySelector("span").textContent=cnt(r.saves);toast(t(x.d.saved?"Guardado":"Quitar de guardados"))}
function rlShare(i){const r=RL[i],u=location.origin+"/p/"+r.id;if(navigator.share)return navigator.share({title:"Reel · "+r.author.replace(/_/g," "),text:r.body||"",url:u}).catch(()=>{});navigator.clipboard.writeText(u).then(()=>toast(t("Enlace copiado")),()=>{})}
function rlCopy(i){navigator.clipboard.writeText(location.origin+"/p/"+RL[i].id).then(()=>toast(t("Enlace copiado")),()=>{})}
async function rlAdd(i){const r=RL[i],b=$("#rf"+i);b.disabled=true;const x=await api("/friends/request",{method:"POST",body:{name:r.author}});if(!x.ok){b.disabled=false;return toast(x.d.error||"Error")}
 RL.forEach((y,k)=>{if(y.author===r.author){y.fstate=x.d.state;const c=$("#rf"+k);if(c){c.textContent=t(x.d.state==="friends"?"Amigos":"Solicitud enviada");c.disabled=true}}})}
function rlMenu(i){const r=RL[i],own=U&&(U.name===r.author||U.canPost);
 modal(`<div class="mm"><button class="btn" onclick="cerrar();rlSave(${i})">${ic("guardar")} ${t(r.saved>0?"Quitar de guardados":"Guardar")}</button><button class="btn" onclick="cerrar();rlCopy(${i})">${ic("compartir_vincular")} ${t("Copiar enlace")}</button><a class="btn" href="${lk(r.author)}">${ic("usuario_perfil")} ${t("Ver perfil")}</a>${own?`<button class="btn" onclick="cerrar();rlDel(${i})">${t("Eliminar reel")}</button>`:""}<button class="btn" onclick="cerrar()">${t("Cerrar")}</button></div>`)}
async function rlDel(i){if(!confirm(t("¿Eliminar este reel?")))return;const x=await api("/posts/"+RL[i].id,{method:"DELETE"});if(!x.ok)return toast(x.d.error||"Error");
 const el=$("#rl"+i);el.querySelector("video").pause();el.remove();toast(t("Eliminado"))}
// ---- Comentarios (hoja desde abajo) ----
async function rlCom(i){RCOM=i;const c=$("#rlc");c.classList.add("on");c.setAttribute("aria-hidden","false");
 c.innerHTML=`<div class="rlch"><b>${t("Comentarios")}</b><button type="button" class="x" onclick="rlComX()" aria-label="${t("Cerrar")}">${ic("cerrar")}</button></div><div class="rlcl" id="rlcl"><div class="sk" style="height:3rem"></div></div>${U?`<div class="rlci">${skin(U.skin,U.name)}<input id="rlci" data-mn maxlength="300" placeholder="${t("Escribe un comentario…")}" aria-label="${t("Escribe un comentario…")}"><button class="btn p s" type="button" onclick="rlSend()">${t("Enviar")}</button></div>`:`<div class="rlci"><button class="btn p s" type="button" onclick="login()">${t("Iniciar sesión")}</button></div>`}`;
 const inp=$("#rlci");if(inp)inp.onkeydown=e=>{if(e.key==="Enter")rlSend()};await rlList()}
function rlComX(){const c=$("#rlc");c.classList.remove("on");c.setAttribute("aria-hidden","true")}
async function rlList(){const r=RL[RCOM],x=await api("/posts/"+r.id+"/comments"),l=$("#rlcl");if(!l)return;if(!x.ok)return l.innerHTML=`<p class="msg">${esc(x.d.error)}</p>`;
 r.comments=x.d.length;$("#rc"+RCOM+" span").textContent=cnt(r.comments);
 l.innerHTML=x.d.map(c=>`<div class="rlcm">${skin(null,c.author)}<div><div class="rlbb"><a href="${lk(c.author)}"><b>${nom(c.author)}</b></a><p>${linkM(c.body)}</p></div><small>${agoS(c.created_at)}${c.del?` · <button class="lk" type="button" onclick="rlDelC(${c.id})">${t("borrar")}</button>`:""}</small></div></div>`).join("")||`<p class="m rlc0">${t("Sé el primero en comentar.")}</p>`}
async function rlSend(){const i=$("#rlci"),v=i.value.trim();if(!v)return;i.disabled=true;const x=await api("/posts/"+RL[RCOM].id+"/comments",{method:"POST",body:{body:v}});i.disabled=false;if(!x.ok)return toast(x.d.error||"Error");i.value="";await rlList();const l=$("#rlcl");l.scrollTop=l.scrollHeight}
async function rlDelC(c){await api("/posts/"+RL[RCOM].id+"/comments/"+c,{method:"DELETE"});rlList()}
const cerrarHoja0=cerrarHoja;cerrarHoja=function(){cerrarHoja0();const el=$("#rl"+RACT);if(el&&!el.classList.contains("pz"))el.querySelector("video").play().catch(()=>{})}; // al cerrar la hoja sigue el reel
// ---- Crear reel: elegir video, descripción y subida con barra de progreso ----
function nuevoReel(){if(!U)return login();HS={};const s=INFO.reelSecs||90,mb=INFO.reelMax||60;document.querySelectorAll("#rls video").forEach(v=>v.pause());
 hoja(hdr("Crear reel",`<button class="btn p s" type="button" id="rnb" disabled onclick="rlPub()">${t("Compartir")}</button>`)+`<div class="shb"><input type="file" id="rnf" accept="video/mp4,video/quicktime,video/webm" hidden onchange="rlPick(this)"><button type="button" class="hs-p rlnp" id="rnp" onclick="$('#rnf').click()">${ic("videos")}<b>${t("Elegir video")}</b><small>MP4 · máx. ${s} s · ${mb} MB</small></button><textarea id="rnc" data-mn maxlength="500" placeholder="${t("Describe tu reel…")}" aria-label="${t("Describe tu reel…")}"></textarea><div class="rlup" id="rnu" hidden><i></i></div><div class="msg" id="rnm" role="alert"></div></div>`)}
async function rlPick(inp){const f=inp.files[0],m=$("#rnm"),s=INFO.reelSecs||90,mb=INFO.reelMax||60;inp.value="";if(!f)return;m.className="msg";m.textContent="";
 if(HS.u)URL.revokeObjectURL(HS.u);HS={};$("#rnb").disabled=true;
 if(!/^video\/(mp4|quicktime|webm)$/.test(f.type))return m.textContent=t("Usa un video MP4");
 if(f.size>mb*1048576)return m.textContent=`${t("El video pesa demasiado")} (máx. ${mb} MB)`;
 m.textContent=t("Leyendo video…");let r;try{r=await vidInfo(f)}catch{r=null}m.textContent="";
 if(!r)return m.textContent=t("No pude leer ese video");if(!(r.dur>0)||r.dur>s+.2)return m.textContent=`${t("El video dura más de")} ${s} ${t("segundos")}`;
 HS={f,thumb:r.thumb,u:URL.createObjectURL(f)};$("#rnp").innerHTML=`<video src="${HS.u}" muted loop autoplay playsinline></video>`;$("#rnp").classList.add("on");$("#rnb").disabled=false}
function subirP(b,kind,thumb,onp){return new Promise(ok=>{const x=new XMLHttpRequest();x.open("POST","/api/media?kind="+kind+(thumb?"&thumb="+thumb:""));x.setRequestHeader("Content-Type",b.type||"application/octet-stream");x.setRequestHeader("X-SC","1");
 x.upload.onprogress=e=>{if(e.lengthComputable&&onp)onp(e.loaded/e.total)};x.onload=()=>{let d=null;try{d=JSON.parse(x.responseText)}catch{}ok(d?{ok:x.status>=200&&x.status<300,d}:{ok:false,d:{error:"Error del servidor"}})};x.onerror=()=>ok({ok:false,d:{error:"Sin conexión con el servidor"}});x.send(b)})}
async function rlPub(){const b=$("#rnb"),m=$("#rnm"),bar=$("#rnu"),er=r=>{m.className="msg";m.textContent=r.d.error||"Error";b.disabled=false;bar.hidden=true};if(!HS.f)return;b.disabled=true;m.className="msg ok";m.textContent=t("Subiendo video")+"…";bar.hidden=false;
 const th=await subirP(HS.thumb,"img");if(!th.ok)return er(th);
 const v=await subirP(HS.f,"rel",th.d.id,p=>{bar.firstChild.style.width=Math.round(p*100)+"%";m.textContent=`${t("Subiendo video")} ${Math.round(p*100)}%`});if(!v.ok)return er(v);
 const r=await api("/reels",{method:"POST",body:{media:v.d.id,body:$("#rnc").value}});if(!r.ok)return er(r);
 cerrarHoja();toast(t("Reel publicado"));location.href="/reels?r="+r.d.id}
// teclado (flechas, m = sonido, espacio = pausa) y pausa al salir de la pestaña
addEventListener("keydown",e=>{if(/INPUT|TEXTAREA/.test(document.activeElement.tagName)||$("#mod.on")||$("#sh.on"))return;const box=$("#rls");if(!box)return;
 if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();$("#rl"+Math.max(0,RACT+(e.key==="ArrowDown"?1:-1)))?.scrollIntoView({behavior:"smooth"})}
 else if(e.key==="m")rlMute();else if(e.key===" "){e.preventDefault();const v=$("#rl"+RACT+" video");if(v){if(v.paused){v.play().catch(()=>{});$("#rl"+RACT).classList.remove("pz")}else{v.pause();$("#rl"+RACT).classList.add("pz")}}}else if(e.key==="Escape")rlComX()});
document.addEventListener("visibilitychange",()=>{const v=$("#rl"+RACT+" video");if(!v)return;if(document.hidden)v.pause();else if(!$("#rl"+RACT).classList.contains("pz"))v.play().catch(()=>{})});
mountPage(pg_reels);
