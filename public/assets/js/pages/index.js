// Página: SampCity RolePlay (/)
async function pg_home(){await info();const[a,b]=await Promise.all([api("/posts?type=photo&page=0"),api("/posts?type=news&page=0")]);const ph=(a.ok?a.d:[]).filter(p=>/^(https:\/\/|\/img\/\d+$)/.test(p.body)).slice(0,6);window.PH=ph;const nw=(b.ok?b.d:[]).slice(0,5);
return `<section class="card pf">${skin(U.skin,U.name,"xl")}<h2>${esc(U.name.replace(/_/g," "))}</h2><div><span class="pill">${t(U.rango)}</span>${U.vip>0?' <span class="pill">VIP</span>':""}</div><a class="btn p wide" href="samp://${SV_HOST}:${SV_PORT}">${t("Jugar ahora")}</a><button class="btn wide" data-ip="${SV_HOST}:${SV_PORT}" onclick="copiar(this)">${ic("copiar_ip")} ${t("Copiar IP")}</button><hr><a class="btn wide" href="/perfil">${t("Mi perfil")}</a><button class="btn wide" onclick="salir()">${t("Cerrar sesión")}</button></section>`
+(ph.length?`<h2 class="ttl">${t("Fotos de la comunidad")}</h2><div class="gal two">${ph.map((p,i)=>`<button onclick="foto(${i})"><img class="bg" aria-hidden="true" alt="" decoding="async" loading="lazy" src="${esc(p.body)}"><img loading="lazy" decoding="async" src="${esc(p.body)}" alt="${esc(p.title)}"><small>${esc(p.author.replace(/_/g," "))}</small></button>`).join("")}</div>`:"")
+`<div class="ttlr" style="margin-top:1.4rem"><h2 class="ttl">${t("Últimas Noticias")}</h2><a href="/noticias">${t("Ver todas")} »</a></div>`+(nw.length?`<div class="nw">${nw.map(p=>nCard(p,false)).join("")}</div>`:`<div class="card m">${t("Aún no hay publicaciones.")}</div>`)+cta()}
async function pg_landing(){await info();const r=await api("/posts?type=news&page=0"),nw=(r.ok?r.d:[]).slice(0,5);
setTimeout(bindLanding);
return `<h1 class="wl">${t("Bienvenid@")}<br>${t("a SampCity")}</h1>
<p class="wp">${t("Vive el mejor rol de GTA San Andreas en SA-MP: conoce gente, crea tu historia y disfruta de eventos. Gratis y en español.")}</p>
<p class="m" style="margin:.8rem 0 1.4rem">${t("Tu cuenta se crea dentro del juego; después inicia sesión aquí.")}</p>
<section class="card lgn"><h3>${t("Inicia sesión")}</h3>
<label for="hn">${t("Nombre de usuario")}</label><div class="fi"><span>${ic("usuario_perfil")}</span><input id="hn" placeholder="Nombre_Apellido" autocomplete="username" autocapitalize="none" maxlength="24"></div>
<label for="hp">${t("Contraseña")}</label><div class="fi"><span>${ic("candado")}</span><input id="hp" type="password" placeholder="${t("Contraseña")}" autocomplete="current-password" maxlength="72"></div>
<p class="m" style="font-size:.9rem;margin:.7rem 0">${t("¿Has olvidado tu contraseña?")} <a href="${DISCORD}" target="_blank" rel="noopener" style="color:var(--t);font-weight:700">${t("¡Pide ayuda en Discord!")}</a></p>
${INFO.turnstile?'<div id="hcft" style="margin:.4rem 0"></div>':""}<div class="msg" id="hm" role="alert"></div>
<button class="gbtn sm" id="hb2">${t("Entrar")}</button>
<div class="two2"><button class="btn" onclick="registro()">${t("Regístrate")}</button><a class="btn" href="${DISCORD}" target="_blank" rel="noopener">${ic("discord_comentarios")} Discord</a></div>
<p style="text-align:center;margin-top:1rem">${t("¿Aún no tienes cuenta?")} <a href="#" onclick="registro();return false" style="color:var(--rosa);font-weight:700">${t("¡Regístrate directamente!")}</a></p></section>
<section class="card wait"><h3>${t("El servidor te espera")}</h3><p class="m">${t("Rol, eventos y amigos las 24 horas")}</p></section>
${INFO.total!=null?`<section class="card st"><b style="color:var(--rosa)">+${esc(INFO.total)}</b><span>${t("Jugadores registrados")}</span></section>`:""}
<section class="card st"><b style="color:var(--rojo)">24/7</b><span>${t("Servidor siempre activo")}</span></section>
<div class="ttlr" style="margin-top:1.4rem"><h2 class="ttl">${ic("noticias")} ${t("Últimas Noticias")}</h2><a href="/noticias" class="ya">${t("Ver todas")} &gt;&gt;</a></div>`+(nw.length?`<div class="nw">${nw.map(p=>nCard(p)).join("")}</div>`:`<div class="card m">${t("Aún no hay publicaciones.")}</div>`)}
function bindLanding(){const n=$("#hn"),p=$("#hp"),b=$("#hb2");if(!n||!b)return;
 const go=async()=>{if(!need(n,n.value.trim().length>=3,t("Escribe tu nombre (mínimo 3 letras)"),"#hm")||!need(p,p.value.length>0,t("Escribe tu contraseña"),"#hm"))return;
  b.disabled=true;const r=await api("/login",{method:"POST",body:{name:n.value,password:p.value,cf:CF}});b.disabled=false;
  if(!r.ok){resetCaptcha("#hcft");$("#hm").className="msg";return $("#hm").textContent=r.d.error||"Error"}
  await init();location.href="/perfil"};
 b.onclick=go;p.onkeydown=e=>{if(e.key==="Enter")go()};if(INFO.turnstile)captcha("#hcft")}
mountPage(()=>U?pg_home():pg_landing());
