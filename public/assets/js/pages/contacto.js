// Página: Contacto (/contacto)
async function pg_contacto(){await info();let h=`<div class="card"><h3>${ic("contacto")} ${t("Contacto")}</h3><p class="m">${t("¿Dudas, reportes o ideas? Escríbenos; el staff revisará tu mensaje.")}</p>
 <form id="ctf" novalidate onsubmit="return enviarC(event)"><label for="cn">${t("Tu nombre")}</label><input id="cn" maxlength="80" autocomplete="name"><label for="cc">${t("Discord o correo (opcional)")}</label><input id="cc" maxlength="80" autocomplete="email"><label for="cm2">${t("Mensaje")}</label><textarea id="cm2" rows="5" maxlength="1000"></textarea>
 <div class="hp" aria-hidden="true"><label for="cw">Website</label><input id="cw" tabindex="-1" autocomplete="off"></div>${INFO.turnstile?'<div id="cft2" style="margin:.4rem 0"></div>':""}<div class="msg" id="cmsg" role="alert"></div><button class="btn p" id="cs" type="submit">${t("Enviar")}</button></form></div>`;
 if(U?.canPost){const r=await api("/contact");h+=`<div class="card"><h3>${ic("mensajes")} ${t("Mensajes recibidos")}</h3>${r.ok&&r.d.length?r.d.map(c=>`<div class="cmt" style="margin-top:.5rem"><b>${esc(c.name)}</b> <small>${esc(c.contact||t("Sin contacto"))} · ${fecha(c.created_at)}</small> <button class="lk" onclick="delM(${c.id})">${t("borrar")}</button><br>${esc(c.body)}</div>`).join(""):`<p class="m">${t("No hay mensajes.")}</p>`}</div>`}
 setTimeout(()=>{if(INFO.turnstile&&$("#cft2"))captcha("#cft2")});return h}
async function enviarC(e){e.preventDefault();const n=$("#cn"),m=$("#cm2"),b=$("#cs");
 if(!need(n,n.value.trim().length>=2,t("Escribe tu nombre"),"#cmsg")||!need(m,m.value.trim().length>=10,t("El mensaje debe tener al menos 10 letras"),"#cmsg"))return false;
 b.disabled=true;const r=await api("/contact",{method:"POST",body:{name:n.value,contact:$("#cc").value,message:m.value,website:$("#cw").value,cf:CF}});b.disabled=false;
 if(!r.ok){resetCaptcha("#cft2");$("#cmsg").className="msg";$("#cmsg").textContent=r.d.error;return false}
 $("#ctf").reset();resetCaptcha("#cft2");$("#cmsg").className="msg ok";$("#cmsg").textContent=t("¡Mensaje enviado! Gracias.");return false}
async function delM(id){if(confirm(t("¿Borrar este mensaje?"))){await api("/contact/"+id,{method:"DELETE"});show()}}
mountPage(()=>pg_contacto());
