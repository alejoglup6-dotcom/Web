// Página: Vacantes de Staff y Facciones (/solicitar-staff)
// El staff abre / edita / cierra vacantes y revisa solicitudes; los jugadores se postulan con su cuenta.
Object.assign(EN,{"Vacantes abiertas":"Open positions","Todas":"All","Staff":"Staff","Facciones":"Factions","Facción":"Faction","Abrir vacante":"Open a position","Editar vacante":"Edit position","Ver cerradas":"Show closed","Ocultar cerradas":"Hide closed","Postularme":"Apply","Cerrada":"Closed","Completa":"Full","Pendiente":"Pending","Aceptada":"Accepted","Rechazada":"Rejected","Tu solicitud":"Your application","Solicitudes":"Applications","Editar":"Edit","Cerrar vacante":"Close position","Reabrir":"Reopen","Eliminar":"Delete","Cupos":"Spots","Nivel mínimo":"Minimum level","Pide Discord vinculado":"Requires linked Discord","Requisitos":"Requirements","Enviar solicitud":"Send application","¿Por qué quieres este puesto?":"Why do you want this position?","Responde todas las preguntas":"Answer every question","Solicitud enviada. El staff la revisará y te avisaremos aquí.":"Application sent. The staff will review it and notify you here.","Inicia sesión para postularte.":"Log in to apply.","Tipo":"Type","Título del puesto":"Position title","Nombre de la facción":"Faction name","Descripción":"Description","Preguntas para los postulantes (una por línea)":"Questions for applicants (one per line)","Cupos (0 = sin límite)":"Spots (0 = unlimited)","Nivel mínimo (0 = cualquiera)":"Minimum level (0 = any)","Pedir Discord vinculado":"Require linked Discord","Guardar vacante":"Save position","Vacante guardada":"Position saved","Vacante abierta. Se avisó a los jugadores.":"Position opened. Players were notified.","Aceptar":"Accept","Rechazar":"Reject","Mensaje para el jugador (opcional)":"Message for the player (optional)","No hay solicitudes todavía.":"No applications yet.","¿Eliminar esta vacante y todas sus solicitudes?":"Delete this position and all its applications?","Aún no hay vacantes. Pulsa «Abrir vacante» para crear la primera.":"No positions yet. Tap “Open a position” to create the first one.","Solicitud aceptada":"Application accepted","Solicitud rechazada":"Application rejected","Se cerró la vacante: ya está completa.":"The position was closed: all spots are filled.","Vacante cerrada":"Position closed","Vacante reabierta":"Position reopened","Nivel":"Level","Respuestas":"Answers","Más sobre el jugador":"About the player","Volver a pendiente":"Back to pending"});
let VF="all",VALL=0,VD={staff:false,vacancies:[],mine:[]};
const vSt=s=>[t("Pendiente"),t("Aceptada"),t("Rechazada")][s]||"",vCl=s=>["var(--rosa)","var(--okc)","var(--err)"][s]||"var(--m)";
const vTag=v=>`<span style="display:inline-block;padding:.1rem .6rem;border-radius:999px;border:1px solid var(--b);font-size:.78rem;color:var(--rosa);margin-right:.4rem">${v.kind==="faction"?t("Facción")+": "+esc(v.faction):t("Staff")}</span>`;
const vBadge=(s,x)=>`<span style="display:inline-block;padding:.15rem .7rem;border-radius:999px;border:1px solid ${vCl(s)};color:${vCl(s)};font-size:.82rem;font-weight:600">${x||vSt(s)}</span>`;
const vFull=v=>v.slots>0&&Number(v.accepted)>=v.slots;
function vCard(v,mine){
 const m=mine[v.id],S=VD.staff,meta=[];
 if(v.slots>0)meta.push(`${t("Cupos")}: ${Number(v.accepted)||0}/${v.slots}`);
 if(v.min_level>0)meta.push(`${t("Nivel mínimo")}: ${v.min_level}`);
 if(v.need_discord)meta.push(t("Pide Discord vinculado"));
 let act="";
 if(m)act=`<div style="margin-top:.7rem">${t("Tu solicitud")}: ${vBadge(m.status)}${m.note?`<p class="m" style="margin-top:.4rem">“${esc(m.note)}”</p>`:""}</div>`;
 else if(!v.open)act=`<div style="margin-top:.7rem">${vBadge(-1,t("Cerrada"))}</div>`;
 else if(vFull(v))act=`<div style="margin-top:.7rem">${vBadge(-1,t("Completa"))}</div>`;
 else act=`<button class="btn p" type="button" style="margin-top:.7rem" onclick="vApply(${v.id})">${t("Postularme")}</button>`;
 const adm=S?`<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--b)"><button class="btn s" type="button" onclick="vApps(${v.id})">${t("Solicitudes")} (${v.pending||0}/${v.apps||0})</button><button class="btn s" type="button" onclick="vForm(${v.id})">${t("Editar")}</button><button class="btn s" type="button" onclick="vToggle(${v.id},${v.open?0:1})">${t(v.open?"Cerrar vacante":"Reabrir")}</button><button class="btn s" type="button" onclick="vDel(${v.id})">${t("Eliminar")}</button></div>`:"";
 return `<div class="card vac" style="${v.open?"":"opacity:.75"}"><h3>${esc(v.title)}</h3><p class="m" style="margin-bottom:.5rem">${vTag(v)}<small>${fecha(v.created_at)}</small></p>${v.description?`<p style="white-space:pre-line">${esc(v.description)}</p>`:""}${v.requirements?`<h4 style="margin-top:.7rem;font-size:.9rem">${t("Requisitos")}</h4><p class="m" style="white-space:pre-line">${esc(v.requirements)}</p>`:""}${meta.length?`<p class="m" style="margin-top:.6rem;font-size:.85rem">${meta.map(esc).join(" · ")}</p>`:""}${act}${adm}</div>`}
async function pg_solicitar(){
 const r=await api("/vacancies"+(VALL?"?all=1":""));if(!r.ok)return fail(r.d.error,view);
 VD=r.d;const S=VD.staff,mine=Object.fromEntries(VD.mine.map(m=>[m.vacancy_id,m])),l=VD.vacancies.filter(v=>VF==="all"||v.kind===VF);
 const chip=(k,x)=>`<button class="btn s${VF===k?" p":""}" type="button" onclick="VF='${k}';show()">${t(x)}</button>`;
 let h=`<h2 class="ttl">${t("Solicitar ser Staff")}</h2><div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem">${chip("all","Todas")}${chip("staff","Staff")}${chip("faction","Facciones")}${S?`<button class="btn s p" type="button" onclick="vForm()">+ ${t("Abrir vacante")}</button><button class="btn s" type="button" onclick="VALL=${VALL?0:1};show()">${t(VALL?"Ocultar cerradas":"Ver cerradas")}</button>`:""}</div>`;
 if(l.length)h+=l.map(v=>vCard(v,mine)).join("");
 else h+=`<div class="card"><h3 style="font-size:1.5rem">${t("No hay puestos abiertos")}</h3><p class="m">${t("Actualmente no hay puestos vacantes")}</p><p class="m" style="margin-top:.7rem">${t(S?"Aún no hay vacantes. Pulsa «Abrir vacante» para crear la primera.":"Vuelva más tarde para comprobar si tenemos algún puesto vacante. Gracias por su interés.")}</p></div>`;
 h+=`<div class="card"><h3>${t("Aplicar para SampCity staff")}</h3><p class="m">${t("Selecciona un puesto para comenzar")}</p><p class="m" style="margin-top:.7rem">${t("Aquí en SampCity abrimos de vez en cuando las solicitudes de personal. A veces encontrarás esta página vacía, otras veces puede estar llena de puestos, si alguna vez encuentras un puesto en el que crees que encajarías perfectamente, no dudes en solicitarlo.")}</p></div>`;
 return h}
const vGet=id=>VD.vacancies.find(v=>v.id===id);
// ---- Jugador: postularse ----
function vApply(id){
 if(!U){toast(t("Inicia sesión para postularte."));return login()}
 const v=vGet(id);if(!v)return;
 modal(`<h3>${esc(v.title)}</h3><p class="m" style="font-size:.85rem">${vTag(v)}</p>${v.questions.map((x,i)=>`<label for="va${i}">${esc(x)}</label><textarea id="va${i}" rows="3" maxlength="800"></textarea>`).join("")||`<label for="vab">${t("¿Por qué quieres este puesto?")}</label><textarea id="vab" rows="5" maxlength="800"></textarea>`}<div class="msg" id="vmsg" role="alert"></div><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn p" id="vsb" type="button" onclick="vSend(${id})">${t("Enviar solicitud")}</button><button class="btn" type="button" onclick="cerrar()">${t("Cancelar")}</button></div>`,true)}
async function vSend(id){
 const v=vGet(id),ans=v.questions.map((_,i)=>$("#va"+i).value.trim()),about=$("#vab")?$("#vab").value.trim():"",m=$("#vmsg");
 if(v.questions.length?ans.some(a=>a.length<3):about.length<20){m.className="msg";m.textContent=t(v.questions.length?"Responde todas las preguntas":"¿Por qué quieres este puesto?");return}
 const b=$("#vsb");b.disabled=true;const r=await api("/vacancies/"+id+"/apply",{method:"POST",body:{answers:ans,about}});b.disabled=false;
 if(!r.ok){m.className="msg";m.textContent=r.d.error||"Error";return}
 cerrar();toast(t("Solicitud enviada. El staff la revisará y te avisaremos aquí."));show()}
// ---- Staff: crear / editar ----
function vForm(id){
 const v=id?vGet(id):null,k=v?v.kind:"staff";
 modal(`<h3>${t(v?"Editar vacante":"Abrir vacante")}</h3>
 <label for="vk">${t("Tipo")}</label><select id="vk" onchange="$('#vfw').hidden=this.value!=='faction'"><option value="staff"${k==="staff"?" selected":""}>${t("Staff")}</option><option value="faction"${k==="faction"?" selected":""}>${t("Facción")}</option></select>
 <div id="vfw"${k==="faction"?"":" hidden"}><label for="vf">${t("Nombre de la facción")}</label><input id="vf" maxlength="60" value="${esc(v?v.faction:"")}"></div>
 <label for="vt">${t("Título del puesto")}</label><input id="vt" maxlength="80" value="${esc(v?v.title:"")}">
 <label for="vd">${t("Descripción")}</label><textarea id="vd" rows="4" maxlength="1500">${esc(v?v.description:"")}</textarea>
 <label for="vr">${t("Requisitos")}</label><textarea id="vr" rows="3" maxlength="1000">${esc(v?v.requirements:"")}</textarea>
 <label for="vq">${t("Preguntas para los postulantes (una por línea)")}</label><textarea id="vq" rows="4">${esc(v?v.questions.join("\n"):"")}</textarea>
 <label for="vs">${t("Cupos (0 = sin límite)")}</label><input id="vs" type="number" min="0" max="999" inputmode="numeric" value="${v?v.slots:0}">
 <label for="vl">${t("Nivel mínimo (0 = cualquiera)")}</label><input id="vl" type="number" min="0" max="999" inputmode="numeric" value="${v?v.min_level:0}">
 <label style="display:flex;align-items:center;gap:.5rem;color:var(--t)"><input id="vdc" type="checkbox" style="width:auto;margin:0"${v&&v.need_discord?" checked":""}> ${t("Pedir Discord vinculado")}</label>
 <div class="msg" id="vmsg" role="alert"></div><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn p" id="vsb" type="button" onclick="vSave(${id||0})">${t("Guardar vacante")}</button><button class="btn" type="button" onclick="cerrar()">${t("Cancelar")}</button></div>`,true)}
async function vSave(id){
 const body={kind:$("#vk").value,faction:$("#vf").value,title:$("#vt").value,description:$("#vd").value,requirements:$("#vr").value,questions:$("#vq").value.split("\n").map(x=>x.trim()).filter(Boolean),slots:$("#vs").value,min_level:$("#vl").value,need_discord:$("#vdc").checked},b=$("#vsb");
 b.disabled=true;const r=await api("/vacancies"+(id?"/"+id:""),{method:id?"PUT":"POST",body});b.disabled=false;
 if(!r.ok){const m=$("#vmsg");m.className="msg";m.textContent=r.d.error||"Error";return}
 cerrar();toast(t(id?"Vacante guardada":"Vacante abierta. Se avisó a los jugadores."));show()}
async function vToggle(id,open){const r=await api("/vacancies/"+id,{method:"PUT",body:{open}});if(!r.ok)return toast(r.d.error||"Error");toast(t(open?"Vacante reabierta":"Vacante cerrada"));show()}
async function vDel(id){if(!confirm(t("¿Eliminar esta vacante y todas sus solicitudes?")))return;const r=await api("/vacancies/"+id,{method:"DELETE"});if(!r.ok)return toast(r.d.error||"Error");show()}
// ---- Staff: revisar solicitudes ----
async function vApps(id){
 const v=vGet(id),r=await api("/vacancies/"+id+"/applications");if(!r.ok)return toast(r.d.error||"Error");
 const row=a=>`<div class="cmt" style="margin-top:.7rem;padding:.8rem;border:1px solid var(--b);border-radius:.8rem"><div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap"><a href="${lk(a.name)}"><b>${nom(a.name)}</b></a>${vBadge(a.status)}</div><small class="m">${t("Nivel")} ${Number(a.level)||0} · ${esc(a.rango)} · ${fecha(a.created_at)}</small>
 ${a.answers.map(x=>`<p style="margin-top:.5rem;font-size:.85rem" class="m">${esc(x.q)}</p><p style="white-space:pre-line">${esc(x.a)}</p>`).join("")}${a.about?`<p style="margin-top:.5rem;white-space:pre-line">${esc(a.about)}</p>`:""}
 ${a.note?`<p class="m" style="margin-top:.4rem">“${esc(a.note)}”${a.reviewed_by?` — ${nom(a.reviewed_by)}`:""}</p>`:""}
 <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem">${a.status!==1?`<button class="btn s p" type="button" onclick="vRev(${id},${a.id},1)">${t("Aceptar")}</button>`:""}${a.status!==2?`<button class="btn s" type="button" onclick="vRev(${id},${a.id},2)">${t("Rechazar")}</button>`:""}${a.status?`<button class="btn s" type="button" onclick="vRev(${id},${a.id},0)">${t("Volver a pendiente")}</button>`:""}</div></div>`;
 modal(`<h3>${t("Solicitudes")}: ${esc(v?v.title:"")}</h3>${r.d.length?r.d.map(row).join(""):`<p class="m">${t("No hay solicitudes todavía.")}</p>`}<div style="margin-top:.8rem"><button class="btn" type="button" onclick="cerrar()">${t("Cerrar")}</button></div>`,true)}
async function vRev(vid,aid,st){
 let note="";if(st){note=prompt(t("Mensaje para el jugador (opcional)"),"");if(note===null)return}
 const r=await api("/applications/"+aid+"/review",{method:"POST",body:{status:st,note}});if(!r.ok)return toast(r.d.error||"Error");
 toast(t(st===1?"Solicitud aceptada":st===2?"Solicitud rechazada":"Pendiente"));if(r.d.closed)toast(t("Se cerró la vacante: ya está completa."));
 await show();vApps(vid)}
mountPage(()=>pg_solicitar());
