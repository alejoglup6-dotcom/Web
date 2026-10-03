// Página: Feed (/feed) - solo publicaciones de tus amigos (y las tuyas)
async function pg_feedsoc(){
 const head=`<h2 class="ttl">${ic("comunidad")} ${t("Feed")}</h2>`;
 if(!U)return head+composer();
 const r=await api("/posts?type=feed&page="+PG);if(!r.ok)return fail(r.d.error,view);
 const more=r.d.length>12,l=r.d.slice(0,12);
 return head+frBanner()+composer()+(U.friends?"":frEmpty())+(l.length?l.map(postHtml).join("")+(PG||more?pgn(more):""):(U.friends?frNone():""))}
mountPage(pg_feedsoc);
