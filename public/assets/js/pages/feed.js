// Página: Feed (/feed) - publicaciones de jugadores, noticias y actualizaciones
async function pg_feedsoc(){const r=await api("/posts?type=feed&page="+PG);if(!r.ok)return fail(r.d.error,view);
 const more=r.d.length>12,l=r.d.slice(0,12);
 return `<h2 class="ttl">${ic("comunidad")} ${t("Feed")}</h2>`+composer()+(l.length?l.map(postHtml).join("")+(PG||more?pgn(more):""):`<div class="card m">${t("Aún no hay publicaciones. ¡Sé el primero!")}</div>`)}
mountPage(pg_feedsoc);
