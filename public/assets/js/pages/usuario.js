// Página: perfil público de un jugador (/u/Nombre_Apellido) con sus publicaciones
const UN=decodeURIComponent(location.pathname.split("/")[2]||"");
async function pg_usuario(){
 const[a,b]=await Promise.all([api("/user/"+encodeURIComponent(UN)),api("/posts?type=post&author="+encodeURIComponent(UN)+"&page="+PG)]);
 if(!a.ok){window.PTITLE=t("Jugador no encontrado");return `<div class="card"><h3>${t("Jugador no encontrado")}</h3><p class="m">${t("No existe ningún jugador con ese nombre.")}</p><a class="btn p" style="margin-top:.6rem" href="/feed">${t("Ir al feed")}</a></div>`}
 const u=a.d,nm=u.name.replace(/_/g," "),own=!!U&&U.name===u.name,l=b.ok?b.d.slice(0,12):[],more=b.ok&&b.d.length>12;window.PTITLE=nm;
 const kv=(k,v)=>`<div><small>${t(k)}</small><b>${v}</b></div>`;
 return `<div class="card"><div class="cover"></div><div class="pr">${skin(u.skin,u.name,"lg")}<div><h2 style="font-family:'Russo One';font-weight:400">${esc(nm)}</h2><span class="pill">${t(u.rango)}</span> ${u.connected?`<span class="chip"><span class="dot on"></span>${t("En línea")}</span>`:""}</div></div>
 <div class="kv">${kv("Nivel",esc(u.level))}${kv("Reputación",esc(u.rep))}${kv("Tiempo jugado",esc(horas(u.time_playing)))}${kv("Publicaciones",u.posts)}${kv("Me gusta recibidos",u.likes)}${kv("Registro",u.reg_date?fecha(u.reg_date):"—")}${kv("Última conexión",u.last_connection?fecha(u.last_connection):"—")}</div>
 ${own?`<a class="btn s" style="margin-top:.8rem" href="/perfil">${ic("usuario_perfil")} ${t("Mi cuenta")}</a>`:""}</div>`
 +(own?composer():"")+`<h2 class="ttl">${t("Publicaciones")}</h2>`+(l.length?l.map(postHtml).join("")+(PG||more?pgn(more):""):`<div class="card m">${t("Aún no hay publicaciones.")}</div>`)}
mountPage(pg_usuario);
