// Página: Comunidad (/comunidad)
function pg_comunidad(){return `<div class="card"><h3>${ic("comunidad")} ${t("Comunidad")}</h3><p class="m">${t("Aquí está nuestra gente: charla, eventos, soporte y mucho rol.")}</p><p style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap"><a class="btn p" href="${DISCORD}" target="_blank" rel="noopener">${ic("discord_comentarios")} Discord</a><a class="btn" href="${TIKTOK}" target="_blank" rel="noopener">${ic("tiktok")} TikTok</a></p></div><div class="card"><h3>${ic("fotos")} ${t("Fotos")}</h3><p class="m">${t("Mira las capturas de la comunidad.")}</p><a class="btn" style="margin-top:.6rem" href="/fotos">${t("Ver galería")}</a></div>`+cta()}

mountPage(()=>pg_comunidad());
