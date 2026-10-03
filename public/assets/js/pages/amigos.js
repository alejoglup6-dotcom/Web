// Página: Amigos (/amigos) · solicitudes recibidas, personas que quizás conozcas, buscador y mis amigos
Object.assign(EN,{"Buscar jugadores por nombre":"Search players by name","Personas que quizás conozcas":"People you may know","Mis amigos":"My friends","Aún no tienes amigos. Agrega a alguien de las sugerencias.":"You have no friends yet. Add someone from the suggestions.","No hay más personas para sugerir por ahora.":"No more people to suggest for now.","Inicia sesión para ver y agregar amigos.":"Log in to see and add friends.","amigo en común":"mutual friend","amigos en común":"mutual friends","En línea":"Online","Nivel":"Level","Sin resultados":"No results","Escribe al menos 2 letras":"Type at least 2 letters"});
let AT=0;
const frMut=n=>n?`${n} ${t(n===1?"amigo en común":"amigos en común")}`:"";
const frCard=(u,info,rl)=>`<div class="fcard"><a class="fca" href="${lk(u.name)}">${skin(u.skin,u.name,"lg")}<b>${nom(u.name)}</b></a><small>${info||"&nbsp;"}</small><div class="act fra" data-n="${esc(u.name)}"${rl?" data-rl":""}>${frActs(u.name,u.state||(rl==="req"?"received":"none"))}</div></div>`;
const frSec=(h,body)=>`<section><h3 class="fh">${h}</h3>${body}</section>`;
async function pg_amigos(){
 if(!U)return `<h2 class="ttl">${ic("etiquetar")} ${t("Amigos")}</h2><div class="card"><p class="m">${t("Inicia sesión para ver y agregar amigos.")}</p><button class="btn p" style="margin-top:.7rem" onclick="login()">${t("Iniciar sesión")}</button></div>`;
 const[a,b,c]=await Promise.all([api("/friends/requests"),api("/friends/suggestions"),api("/friends")]);
 if(!b.ok)return fail(b.d.error,view);
 const rq=a.ok?a.d:[],sg=b.d,fr=c.ok?c.d:[];
 setTimeout(()=>{const i=$("#fq");if(i)i.oninput=()=>{clearTimeout(AT);AT=setTimeout(amFind,300)}});
 return `<h2 class="ttl">${ic("etiquetar")} ${t("Amigos")}</h2>
 <div class="card"><input id="fq" type="search" maxlength="24" autocomplete="off" placeholder="${t("Buscar jugadores por nombre")}" aria-label="${t("Buscar jugadores por nombre")}"><div id="fres"></div></div>`
 +(rq.length?frSec(`${t("Solicitudes de amistad")} <span class="pill">${rq.length}</span>`,`<div class="fgrid">${rq.map(u=>frCard(u,frMut(u.mutual),"req")).join("")}</div>`):"")
 +frSec(t("Personas que quizás conozcas"),sg.length?`<div class="fgrid">${sg.map(u=>frCard(u,frMut(u.mutual)||(u.connected>0?"● "+t("En línea"):t("Nivel")+" "+esc(u.level)))).join("")}</div>`:`<div class="card m">${t("No hay más personas para sugerir por ahora.")}</div>`)
 +frSec(`${t("Mis amigos")} <small>· ${fr.length}</small>`,fr.length?`<div class="fgrid">${fr.map(u=>frCard({...u,state:"friends"},u.connected>0?"● "+t("En línea"):"","fl")).join("")}</div>`:`<div class="card m">${t("Aún no tienes amigos. Agrega a alguien de las sugerencias.")}</div>`)}
async function amFind(){
 const i=$("#fq"),box=$("#fres");if(!i||!box)return;const v=i.value.trim();
 if(v.length<2){box.innerHTML=v?`<p class="m" style="font-size:.85rem">${t("Escribe al menos 2 letras")}</p>`:"";return}
 const r=await api("/friends/search?q="+encodeURIComponent(v));if(i.value.trim()!==v)return; // llegó tarde: ya escribieron otra cosa
 box.innerHTML=r.ok?(r.d.length?`<div class="fgrid" style="margin-top:.7rem">${r.d.map(u=>frCard(u,u.connected>0?"● "+t("En línea"):"")).join("")}</div>`:`<p class="m" style="margin-top:.6rem">${t("Sin resultados")}</p>`):`<p class="msg">${esc(r.d.error||"Error")}</p>`}
mountPage(pg_amigos);
