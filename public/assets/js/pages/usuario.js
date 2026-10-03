// Página: perfil público de un jugador (/u/Nombre_Apellido) · mismo diseño que /perfil (perfilFB en core.js)
const UN=decodeURIComponent(location.pathname.split("/")[2]||"");
mountPage(()=>perfilFB(UN));
