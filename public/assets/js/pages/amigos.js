// Página: Amigos (/amigos) · estilo Facebook: solicitudes (Confirmar/Eliminar), Sugerencias, Tus amigos y buscador
Object.assign(EN,{"Buscar jugadores por nombre":"Search players by name","Personas que quizás conozcas":"People you may know","Sugerencias":"Suggestions","Tus amigos":"Your friends","Aún no tienes amigos. Agrega a alguien de las sugerencias.":"You have no friends yet. Add someone from the suggestions.","No hay más personas para sugerir por ahora.":"No more people to suggest for now.","Inicia sesión para ver y agregar amigos.":"Log in to see and add friends.","amigo en común":"mutual friend","amigos en común":"mutual friends","En línea":"Online","Nivel":"Level","Sin resultados":"No results","Escribe al menos 2 letras":"Type at least 2 letters","No tienes solicitudes pendientes.":"You have no pending requests.","Agregar amigo":"Add friend","Solicitud eliminada":"Request removed","Ahora son amigos":"You are now friends","Sugerencia eliminada":"Suggestion removed","Ver todas":"See all","Buscar":"Search"});
let AT=0,AM=new URLSearchParams(location.search).get("tab")||"",AV=false;
const frMut=u=>{const n=Number(u.mutual)||0;return n?`${(u.faces||[]).length?`<span class="frf">${u.faces.map(f=>skin(f.skin,f.name)).join("")}</span>`:""}${n} ${t(n===1?"amigo en común":"amigos en común")}`:""};
const frInfo=(u,ex)=>[frMut(u),ex].filter(Boolean).join(" · ");
// fila estilo Facebook: foto grande a la izquierda; nombre, amigos en común y botones a la derecha
const frRow=(u,info,acts)=>`<div class="frw"><a href="${lk(u.name)}" class="frp">${skin(u.skin,u.name,"lg")}</a><div class="frm"><a href="${lk(u.name)}"><b>${nom(u.name)}</b></a>${info?`<small>${info}</small>`:""}<div class="frk" data-n="${esc(u.name)}">${acts}</div></div></div>`;
const frBtn=(n,k)=>{const e=esc(n);return k==="req"?`<button class="btn p" type="button" onclick="frAct(this,'${e}','acc')">${t("Confirmar")}</button><button class="btn" type="button" onclick="frAct(this,'${e}','del')">${t("Eliminar")}</button>`
 :k==="sug"?`<button class="btn p" type="button" onclick="frAct(this,'${e}','add')">${t("Agregar amigo")}</button><button class="btn" type="button" onclick="frAct(this,'${e}','hide')">${t("Eliminar")}</button>`
 :k==="sent"?`<button class="btn" type="button" onclick="frAct(this,'${e}','cancel')">${t("Cancelar solicitud")}</button>`
 :k==="friends"?`<button class="btn" type="button" onclick="amUnf('${e}')">✓ ${t("Amigos")}</button>`:frBtn(n,"sug")};
async function frAct(b,n,act){
 const box=b.closest(".frk");if(act==="hide"){b.closest(".frw").remove();return toast(t("Sugerencia eliminada"))}
 box.querySelectorAll("button").forEach(x=>x.disabled=true);
 const r=await api(act==="acc"?"/friends/accept":act==="add"?"/friends/request":"/friends/"+encodeURIComponent(n),{method:act==="acc"||act==="add"?"POST":"DELETE",body:{name:n}});
 if(!r.ok){box.querySelectorAll("button").forEach(x=>x.disabled=false);return toast(r.d.error||"Error")}
 const st=r.d.state;
 box.innerHTML=act==="acc"||st==="friends"?`<p class="frd">${t("Ahora son amigos")}</p>`:act==="del"?`<p class="frd">${t("Solicitud eliminada")}</p>`:st==="sent"?`<p class="frd">${t("Solicitud enviada")}</p>`+frBtn(n,"sent"):frBtn(n,"sug");
 await init()} // actualiza el contador de solicitudes de la barra inferior
function amUnf(n){modal(`<h3>${nom(n)}</h3><div class="mm"><button class="btn" onclick="cerrar();amDel('${esc(n)}')">${t("Eliminar de amigos")}</button><button class="btn" onclick="cerrar()">${t("Cancelar")}</button></div>`)}
async function amDel(n){const r=await api("/friends/"+encodeURIComponent(n),{method:"DELETE",body:{name:n}});if(!r.ok)return toast(r.d.error||"Error");await init();show()}
function amTab(x){AM=AM===x?"":x;AV=false;try{const u=new URL(location.href);if(AM)u.searchParams.set("tab",AM);else u.searchParams.delete("tab");history.replaceState(null,"",u)}catch{}show()}
function amBuscar(){const s=$("#fqs");s.hidden=!s.hidden;if(!s.hidden)$("#fq").focus()}
async function pg_amigos(){
 if(!U)return `<h2 class="ttl">${ic("comunidad")} ${t("Amigos")}</h2><div class="card"><p class="m">${t("Inicia sesión para ver y agregar amigos.")}</p><button class="btn p" style="margin-top:.7rem" onclick="login()">${t("Iniciar sesión")}</button></div>`;
 const head=`<div class="fbhd"><h2>${t("Amigos")}</h2><button class="fbib" type="button" onclick="amBuscar()" aria-label="${t("Buscar")}">${ic("buscar")}</button></div>
 <div id="fqs" hidden><input id="fq" type="search" maxlength="24" autocomplete="off" placeholder="${t("Buscar jugadores por nombre")}" aria-label="${t("Buscar jugadores por nombre")}"><div id="fres"></div></div>
 <div class="fpl"><button type="button"${AM==="sug"?' class="on"':""} onclick="amTab('sug')">${t("Sugerencias")}</button><button type="button"${AM==="tus"?' class="on"':""} onclick="amTab('tus')">${t("Tus amigos")}</button></div>`;
 setTimeout(()=>{const i=$("#fq");if(i)i.oninput=()=>{clearTimeout(AT);AT=setTimeout(amFind,300)}});
 if(AM==="tus"){const c=await api("/friends");if(!c.ok)return fail(c.d.error,view);
  return `<div class="fbw2">${head}<div class="fsh"><h3>${t("Tus amigos")} <span class="fcn">${c.d.length}</span></h3></div>`+(c.d.length?c.d.map(u=>frRow(u,Number(u.connected)>0?`<span class="dot on"></span> ${t("En línea")}`:"",frBtn(u.name,"friends"))).join(""):`<p class="m fem">${t("Aún no tienes amigos. Agrega a alguien de las sugerencias.")}</p>`)+`</div>`}
 const[a,b]=await Promise.all([AM==="sug"?Promise.resolve({ok:true,d:[]}):api("/friends/requests"),api("/friends/suggestions")]);
 if(!b.ok)return fail(b.d.error,view);
 const rq=a.ok?a.d:[],sg=b.d.filter(u=>u.state!=="friends"),vis=AV?rq:rq.slice(0,6);
 const reqs=AM==="sug"?"":`<div class="fsh"><h3>${t("Solicitudes de amistad")} <span class="fcn">${rq.length}</span></h3>${rq.length>6&&!AV?`<button class="lk" type="button" onclick="AV=true;show()">${t("Ver todas")}</button>`:""}</div>`
  +(rq.length?vis.map(u=>frRow(u,frInfo(u,agoS(u.created_at)),frBtn(u.name,"req"))).join(""):`<p class="m fem">${t("No tienes solicitudes pendientes.")}</p>`)+`<hr class="fsep">`;
 const sug=`<div class="fsh"><h3>${t("Personas que quizás conozcas")}</h3></div>`+(sg.length?sg.map(u=>frRow(u,frInfo(u,u.mutual?"":Number(u.connected)>0?`<span class="dot on"></span> ${t("En línea")}`:t("Nivel")+" "+esc(u.level)),frBtn(u.name,u.state==="sent"?"sent":u.state==="received"?"req":"sug"))).join(""):`<p class="m fem">${t("No hay más personas para sugerir por ahora.")}</p>`);
 return `<div class="fbw2">${head}${reqs}${sug}</div>`}
async function amFind(){
 const i=$("#fq"),box=$("#fres");if(!i||!box)return;const v=i.value.trim();
 if(v.length<2){box.innerHTML=v?`<p class="m" style="font-size:.85rem;margin:.4rem 0">${t("Escribe al menos 2 letras")}</p>`:"";return}
 const r=await api("/friends/search?q="+encodeURIComponent(v));if(i.value.trim()!==v)return; // llegó tarde: ya escribieron otra cosa
 box.innerHTML=r.ok?(r.d.length?r.d.map(u=>frRow(u,Number(u.connected)>0?`<span class="dot on"></span> ${t("En línea")}`:"",frBtn(u.name,u.state==="received"?"req":u.state))).join(""):`<p class="m" style="margin:.6rem 0">${t("Sin resultados")}</p>`):`<p class="msg">${esc(r.d.error||"Error")}</p>`}
mountPage(pg_amigos);
