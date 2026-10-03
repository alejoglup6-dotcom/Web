// Página: Mi perfil (/perfil) · perfil estilo Facebook con el Resumen de la cuenta (perfilFB en core.js)
function pg_perfil(){if(!U)return `<div class="card"><h3>${ic("usuario_perfil")} ${t("Mi perfil")}</h3><p class="m">${t("Inicia sesión para ver los datos de tu cuenta.")}</p><button class="btn p" style="margin-top:.7rem" onclick="login()">${t("Iniciar sesión")}</button></div>`;
 setTimeout(()=>{const p=new URLSearchParams(location.search).get("discord");if(p&&$("#dm")){$("#dm").textContent=t({ok:"¡Cuenta vinculada!",duplicado:"Esa cuenta de Discord o de SA-MP ya está vinculada.",error:"No se pudo vincular, inténtalo de nuevo."}[p]||"");if(p==="ok")$("#dm").className="msg ok";history.replaceState(null,"","/perfil")}});
 return perfilFB(U.name)}
mountPage(pg_perfil);
