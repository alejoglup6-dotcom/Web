// Página: Notificaciones (/notificaciones) · me gusta, comentarios, menciones, etiquetas, noticias, amistades...
Object.assign(EN,{"Opciones":"Options"});
const NTX={like:["le dio me gusta a tu {o}","liked your {o}"],comment:["comentó tu {o}","commented on your {o}"],reply:["también comentó en una publicación que comentaste","also commented on a post you commented on"],mention:["te mencionó en una publicación","mentioned you in a post"],mention_c:["te mencionó en un comentario","mentioned you in a comment"],tag:["te etiquetó en una publicación","tagged you in a post"],news:["publicó una noticia","posted a news article"],update:["publicó una actualización","posted an update"],friend_req:["te envió una solicitud de amistad","sent you a friend request"],friend_acc:["aceptó tu solicitud de amistad","accepted your friend request"],discord:["Tu cuenta se vinculó con Discord correctamente.","Your account was linked with Discord successfully."],contact:["Hay mensajes nuevos en Contacto.","There are new messages in Contact."]};
const NIC={like:"like",comment:"discord_comentarios",reply:"discord_comentarios",mention:"arroba",mention_c:"arroba",tag:"etiquetar",news:"noticias",update:"actualizaciones",friend_req:"etiquetar",friend_acc:"cuenta_vinculada",discord:"discord_comentarios",contact:"contacto"};
let NF=0,NG="";
const ntTxt=n=>(NTX[n.type]||["",""])[L==="en"?1:0].replace("{o}",n.ptype==="story"?(L==="en"?"story":"historia"):(L==="en"?"post":"publicación"));
const ntHref=n=>n.post_id?"/p/"+n.post_id:n.type==="friend_req"||n.type==="friend_acc"?lk(n.actor||""):n.type==="contact"?"/contacto":n.type==="discord"?"/perfil":"/";
const ntHoy=s=>new Date(String(s).replace(" ","T")).toDateString()===new Date().toDateString();
function ntRow(n){const sys=!n.actor,un=!(n.seen>0);
 return `<div class="nt${un?" un":""}" id="nt${n.id}"><a class="ntl" href="${esc(ntHref(n))}" onclick="return ntOpen(event,${n.id})"><span class="nta">${sys?'<img class="av" src="/assets/icon-192.png" alt="">':skin(n.skin,n.actor)}<span class="ty" data-ty="${esc(n.type)}">${ic(NIC[n.type]||"campana")}</span></span><span class="ntb"><span class="ntx">${sys?"":`<b>${nom(n.actor)}</b> `}${esc(ntTxt(n))}</span>${n.body&&!sys?`<span class="nts">“${esc(n.body)}”</span>`:""}<small class="ntd">${ago(n.created_at)}</small></span>${un?`<i class="ndot" role="img" aria-label="${t("Nueva")}"></i>`:""}</a><button class="ntm" type="button" onclick="ntMenu(${n.id})" aria-label="${t("Opciones")}">•••</button></div>`}
function ntHtml(l){return l.map(n=>{const g=ntHoy(n.created_at)?"Hoy":"Anteriores",h=g!==NG?`<h4>${t(g)}</h4>`:"";NG=g;return h+ntRow(n)}).join("")}
async function pg_notif(){
 if(!U)return `<div class="card"><h3>${ic("campana")} ${t("Notificaciones")}</h3><p class="m">${t("Inicia sesión para ver tus notificaciones.")}</p><button class="btn p" style="margin-top:.7rem" onclick="login()">${t("Iniciar sesión")}</button></div>`;
 const r=await api("/notifications"+(NF?"?unread=1":""));if(!r.ok)return fail(r.d.error,view);
 const more=r.d.length>30,l=r.d.slice(0,30);NG="";
 return `<h2 class="ttl">${ic("campana")} ${t("Notificaciones")}</h2><div class="nbar"><button class="btn s${NF?"":" p"}" type="button" onclick="ntF(0)">${t("Todas")}</button><button class="btn s${NF?" p":""}" type="button" onclick="ntF(1)">${t("No leídas")}</button><button class="lk" type="button" onclick="ntAll()">${t("Marcar todo como leído")}</button></div>`
 +(l.length?`<div class="card nl" id="ntl">${ntHtml(l)}</div>${more?`<div class="pgn" id="ntmore"><button class="btn" type="button" onclick="ntMore(${l.at(-1).id})">${t("Ver anteriores")}</button></div>`:""}`:`<div class="card m ntE">${t(NF?"No tienes notificaciones sin leer.":"Aún no tienes notificaciones.")}</div>`)}
function ntF(f){NF=f;show()}
async function ntMore(before){const b=$("#ntmore button");if(b)b.disabled=true;const r=await api("/notifications?before="+before+(NF?"&unread=1":""));if(!r.ok){if(b)b.disabled=false;return toast(r.d.error||"Error")}
 const more=r.d.length>30,l=r.d.slice(0,30);$("#ntl").insertAdjacentHTML("beforeend",ntHtml(l));if(more)$("#ntmore").innerHTML=`<button class="btn" type="button" onclick="ntMore(${l.at(-1).id})">${t("Ver anteriores")}</button>`;else $("#ntmore")?.remove()}
// marca como leída y entra (espera un instante a que el servidor lo anote para que la insignia de la siguiente página sea correcta)
function ntOpen(e,id){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return true;const a=e.currentTarget,row=$("#nt"+id);e.preventDefault();
 if(row&&row.classList.contains("un")){NN=Math.max(0,NN-1);paintBadge()}
 Promise.race([api("/notifications/read",{method:"POST",body:{id}}),new Promise(r=>setTimeout(r,800))]).then(()=>{location.href=a.getAttribute("href")});return false}
function ntMenu(id){modal(`<div class="mm"><button class="btn" onclick="cerrar();ntRead1(${id})">${t("Marcar como leída")}</button><button class="btn" onclick="cerrar();ntDel(${id})">${t("Eliminar")}</button><button class="btn" onclick="cerrar()">${t("Cerrar")}</button></div>`)}
async function ntRead1(id){const row=$("#nt"+id);if(!row||!row.classList.contains("un"))return;const r=await api("/notifications/read",{method:"POST",body:{id}});if(!r.ok)return toast(r.d.error||"Error");row.classList.remove("un");row.querySelector(".ndot")?.remove();NN=Math.max(0,NN-1);paintBadge();if(NF)show()}
async function ntDel(id){const row=$("#nt"+id),un=row&&row.classList.contains("un"),r=await api("/notifications/"+id,{method:"DELETE"});if(!r.ok)return toast(r.d.error||"Error");if(un){NN=Math.max(0,NN-1);paintBadge()}show()}
async function ntAll(){const r=await api("/notifications/read",{method:"POST",body:{}});if(!r.ok)return toast(r.d.error||"Error");NN=0;paintBadge();show()}
mountPage(()=>pg_notif());
