// Página: SampCity RolePlay (/) · portada con disposición tipo Facebook (inicio con sesión y login)
Object.assign(EN,{"Crear cuenta nueva":"Create new account","Nombre de usuario":"Username","Crear publicación":"Create post","Opciones":"Options","Únete al Discord para soporte y eventos":"Join the Discord for support and events","Jugar ahora":"Play now"});
const fbBody=m=>{document.body.classList.toggle("fb-home",m==="home");document.body.classList.toggle("fb-login",m==="login");$("#fbi").innerHTML=""};
const fbPost=p=>{(window.PS=window.PS||{})[p.id]=p;const mine=U&&(U.canPost||((p.type==="post"||p.type==="story")&&p.author===U.name));
return `<article class="fbp"><div class="fbh">${skin(p.skin,p.author)}<div><a href="/u/${encodeURIComponent(p.author)}"><b>${esc(p.author.replace(/_/g," "))}</b></a>${tagsHtml(p)}${p.type==="post"?"":`<span class="tag">${t(TIT[p.type]||"")}</span>`}<br><small>${ago(p.created_at)}</small></div>${mine?`<button class="fbo" onclick="opc(${p.id})" aria-label="${t("Opciones")}">•••</button>`:""}</div>${p.title?`<h3>${esc(p.title)}</h3>`:""}${p.body?`<p>${esc(p.body)}</p>`:""}${mediaHtml(p)}<div class="fba"><button class="${p.mine>0?"p":""}" id="l${p.id}" onclick="like(${p.id})" aria-label="Like">${ic("like")} <span>${p.likes}</span></button><button id="cb${p.id}" onclick="coms(${p.id})" aria-label="Comentarios">${ic("discord_comentarios")} <span>${p.comments}</span></button><button onclick="compartir(${p.id})" aria-label="${t("Compartir")}">${ic("compartir_vincular")}</button></div><div id="c${p.id}"></div></article>`};
function opc(id){modal(`<div class="mm">${U.canPost?`<button class="btn" onclick="cerrar();editar(${id})">${t("Editar")}</button>`:""}<button class="btn" onclick="cerrar();borrar(${id})">${t("Eliminar")}</button><button class="btn" onclick="cerrar()">${t("Cerrar")}</button></div>`)}
async function pg_home(){fbBody("home");await info();
const[a,r]=await Promise.all([api("/posts?type=story"),api("/posts?type=feed&page="+PG)]);
if(!r.ok)return fail(r.d.error,view);
const more=r.d.length>12,l=r.d.slice(0,12),ip=SV_HOST+":"+SV_PORT;
$("#fbi").innerHTML=`<a class="fbc" href="samp://${ip}" aria-label="${t("Jugar ahora")}">${ic("jugar")}</a><button class="fbc" type="button" aria-label="${t("Copiar IP")}" onclick="navigator.clipboard.writeText('${ip}').then(()=>toast(t('Copiada')))">${ic("copiar_ip")}</button><a class="fbc" href="${DISCORD}" target="_blank" rel="noopener" aria-label="Discord">${ic("discord_comentarios")}</a>`;
fbNav();
return `<div class="fbw"><div class="fbc2">${skin(U.skin,U.name)}<button class="fbpill" onclick="nuevo()">${t("¿Qué estás pensando?")}</button><button class="gal" type="button" onclick="nuevo(1)" aria-label="${t("Galería")}">${ic("galeria")}</button></div>
${storyStrip(a.ok?a.d:[])}`
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
