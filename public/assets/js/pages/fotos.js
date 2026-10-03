// Página: Fotos (/fotos)
async function pg_fotos(){const r=await api("/posts?type=photo&page="+PG);if(!r.ok)return fail(r.d.error,"fotos");const more=r.d.length>12,ok=r.d.slice(0,12).filter(p=>/^(https:\/\/|\/img\/\d+$)/.test(p.body));window.PH=ok;
 return (U?.canPost?form("photo"):"")+`<h2 class="ttl">${t("Fotos de la comunidad")}</h2>${ok.length?`<div class="gal two">${ok.map((p,i)=>`<button onclick="foto(${i})"><img class="bg" aria-hidden="true" alt="" decoding="async" loading="lazy" src="${esc(p.body)}"><img loading="lazy" decoding="async" src="${esc(p.body)}" alt="${esc(p.title)}"><small>${esc(p.author.replace(/_/g," "))}</small></button>`).join("")}</div>${PG||more?pgn(more):""}`:`<p class="m">${t("Aún no hay fotos. El staff las publica desde aquí.")}</p>`}`+cta()}

mountPage(()=>pg_fotos());
