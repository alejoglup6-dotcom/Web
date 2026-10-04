// Página: Verificación de Discord (/verificar). El botón de verificar del Discord trae aquí: 1) iniciar sesión con la
// cuenta del servidor, 2) vincular Discord (OAuth, /auth/discord?next=verificar), 3) el bot pone el rol y el apodo.
window.LOGIN_NEXT="/verificar";
function pg_verificar(){
 const p=new URLSearchParams(location.search).get("discord");
 const aviso=p?`<p class="msg${p==="ok"?" ok":""}" role="status">${t({ok:"¡Cuenta vinculada!",duplicado:"Esa cuenta de Discord o de SA-MP ya está vinculada.",error:"No se pudo vincular, inténtalo de nuevo."}[p]||"")}</p>`:"";
 if(p)history.replaceState(null,"","/verificar");
 const paso=(n,on,done,tit,txt,btn)=>`<li class="vp${on?" on":""}${done?" done":""}"><span class="vn">${done?"✓":n}</span><div><b>${t(tit)}</b><p class="m">${t(txt)}</p>${on&&btn?btn:""}</div></li>`;
 const logged=!!U,linked=!!U?.discord;
 const pasos=`<ol class="vpasos">
  ${paso(1,!logged,logged,"Inicia sesión con tu cuenta del servidor","El mismo nombre (Nombre_Apellido) y contraseña que usas en el juego. ¿No tienes cuenta? Se crea entrando al servidor.",`<button class="btn p" onclick="login()">${t("Iniciar sesión")}</button> <button class="btn" onclick="registro()">${t("Crear cuenta")}</button>`)}
  ${paso(2,logged&&!linked,linked,"Vincula tu Discord","Discord te pedirá permiso solo para leer tu nombre de usuario e ID. No vemos tus mensajes ni tu correo.",`<a class="btn p" href="/auth/discord?next=verificar">${ic("discord_comentarios")} ${t("Vincular con Discord")}</a>`)}
  ${paso(3,linked,false,"¡Listo! Vuelve al Discord","En menos de un minuto el bot te da acceso a todos los canales y cambia tu apodo por el de tu personaje.",`<a class="btn p" href="${DISCORD}" target="_blank" rel="noopener">${ic("discord_comentarios")} ${t("Abrir el Discord")}</a>`)}
 </ol>`;
 const cuenta=linked?`<p class="m" style="margin-top:.6rem">${t("Cuenta")}: <b>${esc(U.name)}</b> · Discord ID ${esc(U.discord.discord_id)}</p>`:"";
 return `<div class="card"><h3>${ic("cuenta_vinculada")} ${t("Verificación de Discord")}</h3><p class="m">${t("Para ver los canales del Discord de SampCity tienes que vincular tu cuenta del servidor. Así sabemos quién es quién y tu nombre en Discord es el de tu personaje.")}</p>${aviso}${pasos}${cuenta}</div>`;
}
mountPage(pg_verificar);
