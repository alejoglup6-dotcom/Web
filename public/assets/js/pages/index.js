// Página: SampCity RolePlay (/) · portada con disposición tipo Facebook (inicio con sesión y login)
Object.assign(EN,{"Crear cuenta nueva":"Create new account","Nombre de usuario":"Username","Crear publicación":"Create post","Opciones":"Options","Únete al Discord para soporte y eventos":"Join the Discord for support and events","Jugar ahora":"Play now"});
const fbBody=m=>{document.body.classList.toggle("fb-home",m==="home");document.body.classList.toggle("fb-login",m==="login");document.getElementById("fbt")?.remove();$("#fbi").innerHTML=""};
const fbPost=p=>{(window.PS=window.PS||{})[p.id]=p;const mine=U&&(U.canPost||(p.type==="post"&&p.author===U.name));
return `<article class="fbp"><div class="fbh">${skin(p.skin,p.author)}<div><a href="/u/${encodeURIComponent(p.author)}"><b>${esc(p.author.replace(/_/g," "))}</b></a>${p.type==="post"?"":`<span class="tag">${t(TIT[p.type]||"")}</span>`}<br><small>${ago(p.created_at)}</small></div>${mine?`<button class="fbo" onclick="opc(${p.id})" aria-label="${t("Opciones")}">•••</button>`:""}</div>${p.title?`<h3>${esc(p.title)}</h3>`:""}<p>${esc(p.body)}</p><div class="fba"><button class="${p.mine>0?"p":""}" id="l${p.id}" onclick="like(${p.id})" aria-label="Like">${ic("like")} <span>${p.likes}</span></button><button id="cb${p.id}" onclick="coms(${p.id})" aria-label="Comentarios">${ic("discord_comentarios")} <span>${p.comments}</span></button><button onclick="compartir(${p.id})" aria-label="${t("Compartir")}">${ic("compartir_vincular")}</button></div><div id="c${p.id}"></div></article>`};
function opc(id){modal(`<div class="mm">${U.canPost?`<button class="btn" onclick="cerrar();editar(${id})">${t("Editar")}</button>`:""}<button class="btn" onclick="cerrar();borrar(${id})">${t("Eliminar")}</button><button class="btn" onclick="cerrar()">${t("Cerrar")}</button></div>`)}
function nuevo(){modal(`<h3>${t("Crear publicación")}</h3><div class="fbh" style="padding:0 0 .6rem">${skin(U.skin,U.name)}<b>${esc(U.name.replace(/_/g," "))}</b></div><textarea id="wb" rows="4" maxlength="1000" aria-label="${t("Escribe una publicación")}" placeholder="${t("¿Qué estás pensando?")}"></textarea><div class="msg" id="wm" role="alert"></div><button class="btn p" onclick="pubFb()">${t("Publicar")}</button> <button class="btn" onclick="cerrar()">${t("Cancelar")}</button>`);$("#wb").focus()}
async function pubFb(){await publicarMuro();if(!$("#wm").textContent)cerrar()}
async function pg_home(){fbBody("home");await info();
const[a,r]=await Promise.all([api("/posts?type=photo&page=0"),api("/posts?type=feed&page="+PG)]);
if(!r.ok)return fail(r.d.error,view);
const ph=(a.ok?a.d:[]).filter(p=>/^(https:\/\/|\/img\/\d+$)/.test(p.body)).slice(0,8);window.PH=ph;
const more=r.d.length>12,l=r.d.slice(0,12),ip=SV_HOST+":"+SV_PORT;
$("#fbi").innerHTML=`<a class="fbc" href="samp://${ip}" aria-label="${t("Jugar ahora")}">${ic("jugar")}</a><button class="fbc" type="button" aria-label="${t("Copiar IP")}" onclick="navigator.clipboard.writeText('${ip}').then(()=>toast(t('Copiada')))">${ic("copiar_ip")}</button><a class="fbc" href="${DISCORD}" target="_blank" rel="noopener" aria-label="Discord">${ic("discord_comentarios")}</a>`;
const T=[["/","inicio","Inicio"],["/feed","comunidad","Feed"],["/fotos","fotos","Fotos"],["/noticias","noticias","Noticias"],["/actualizaciones","actualizaciones","Actualizaciones"]];
document.body.insertAdjacentHTML("beforeend",`<nav class="fbt" id="fbt" aria-label="${t("Secciones")}">${T.map((x,i)=>`<a href="${x[0]}"${i?"":' class="on"'} aria-label="${t(x[2])}">${ic(x[1])}</a>`).join("")}<a href="/perfil" aria-label="${t("Mi perfil")}">${skin(U.skin,U.name)}</a></nav>`);
return `<div class="fbw"><div class="fbc2">${skin(U.skin,U.name)}<button class="fbpill" onclick="nuevo()">${t("¿Qué estás pensando?")}</button><a href="/fotos" aria-label="${t("Fotos")}">${ic("fotos")}</a></div>
<div class="fbs"><a class="c1" href="#" onclick="nuevo();return false">${skin(U.skin,U.name)}<i>+</i><b>${t("Crear publicación")}</b></a>${ph.map((p,i)=>`<button type="button" onclick="foto(${i})"><img class="f" loading="lazy" decoding="async" src="${esc(p.body)}" alt="${esc(p.title)}"><span class="fr">${skin(p.skin,p.author)}</span><b>${esc(p.author.replace(/_/g," "))}</b></button>`).join("")}</div>`
+(l.length?l.map(fbPost).join("")+(PG||more?pgn(more):""):`<p class="fbe m">${t("Aún no hay publicaciones. ¡Sé el primero!")}</p>`)+`</div>`}
async function pg_landing(){fbBody("login");await info();setTimeout(bindLanding);
return `<div class="fbl"><a class="fbd" href="${DISCORD}" target="_blank" rel="noopener">${ic("discord_comentarios")} ${t("Únete al Discord para soporte y eventos")}</a>
<button class="fbg" type="button" onclick="idioma()">${L==="en"?"English":"Español"}</button>
<img class="fbo2" src="/assets/logo.png" alt="SampCity">
<div class="fbf"><input id="hn" placeholder=" " autocomplete="username" autocapitalize="none" maxlength="24"><label for="hn">${t("Nombre de usuario")}</label></div>
<div class="fbf"><input id="hp" type="password" placeholder=" " autocomplete="current-password" maxlength="72"><label for="hp">${t("Contraseña")}</label></div>
${INFO.turnstile?'<div id="hcft" style="margin:.4rem 0"></div>':""}<div class="msg" id="hm" role="alert"></div>
<button class="btn p fbb" id="hb2">${t("Iniciar sesión")}</button>
<a class="fbq" href="${DISCORD}" target="_blank" rel="noopener">${t("¿Has olvidado tu contraseña?")}</a>
<button class="btn fbn" type="button" onclick="registro()">${t("Crear cuenta nueva")}</button>
<img class="fbz" src="/assets/logo.png" alt="SampCity"></div>`}
function bindLanding(){const n=$("#hn"),p=$("#hp"),b=$("#hb2");if(!n||!b)return;
 const go=async()=>{if(!need(n,n.value.trim().length>=3,t("Escribe tu nombre (mínimo 3 letras)"),"#hm")||!need(p,p.value.length>0,t("Escribe tu contraseña"),"#hm"))return;
  b.disabled=true;const r=await api("/login",{method:"POST",body:{name:n.value,password:p.value,cf:CF}});b.disabled=false;
  if(!r.ok){resetCaptcha("#hcft");$("#hm").className="msg";return $("#hm").textContent=r.d.error||"Error"}
  await init();location.href="/perfil"};
 b.onclick=go;p.onkeydown=e=>{if(e.key==="Enter")go()};if(INFO.turnstile)captcha("#hcft")}
mountPage(()=>U?pg_home():pg_landing());
