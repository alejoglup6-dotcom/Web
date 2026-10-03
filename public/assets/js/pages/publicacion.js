// Página: una publicación o historia con su propio enlace (/p/123)
const PID=Number(location.pathname.split("/")[2])||0;
async function pg_publicacion(){const r=await api("/posts/"+PID);window.PTITLE=t("Publicación");
 if(!r.ok)return `<div class="card"><h3>${t(r.d.error==="Esta historia ya caducó"?"Esta historia ya caducó":"Publicación no encontrada")}</h3><p class="m">${t("Puede que se haya eliminado o que ya no esté disponible.")}</p><a class="btn p" style="margin-top:.6rem" href="/">${t("Ir al inicio")}</a></div>`;
 const p=r.d;window.PTITLE=(p.author.replace(/_/g," "))+(p.body?": "+exc(p.body).slice(0,60):"");(window.PS=window.PS||{})[p.id]=p;
 if(p.type==="story")setTimeout(()=>abrirVisor({author:p.author,skin:p.skin,items:[p]},0,true));else setTimeout(()=>coms(p.id));
 return `<a class="btn s" href="/" style="margin-bottom:.8rem">‹ ${t("Inicio")}</a>`+postHtml(p)}
mountPage(pg_publicacion);
