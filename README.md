# SampCity Web

1. `cp .env.example .env` y rellena los datos (base de datos, SESSION_SECRET, Discord).
2. `npm install` y `npm start`.
3. En el Discord Developer Portal (OAuth2) agrega el redirect: `https://TU-DOMINIO/auth/discord/callback`.

- Login: usa el mismo nombre y contraseña del juego (bcrypt o SHA256+sal, como snrp.pwn).
- La web solo crea la tabla `web_posts`; las demás (`player`, `discord_links`, `crews`) ya existen y solo se leen,
  salvo `discord_links`, donde se inserta/borra la vinculación.
- Noticias/actualizaciones/FAQ: las publica quien tenga `admin_level` >= POST_MIN_LEVEL (por defecto 5 = Administrador, en la escala de staff 0-9 del 04-oct-2026; si en Render está en 4, cámbialo a 5).

- Fotos: el staff las publica por enlace https:// (tipo `photo`), sin subir archivos.
- `SERVER_IP` (opcional) en el `.env` muestra el botón "Copiar IP"; `/api/info` solo da cifras públicas.
- En TV: se navega con las flechas del control remoto (se activa solo, o con `?tv=1`).

## Novedades
- Me gusta y comentarios en noticias/actualizaciones/fotos (hay que iniciar sesión; el staff puede borrar comentarios).
- Fotos: el staff las sube desde el celular o PC (se reducen solas, máx. 900 KB y se guardan en la base de datos) o por enlace https.
- Sección Reglas y botón Editar para el staff.
- Los intentos de login se guardan en la base de datos (tabla `web_tries`).
- Tablas nuevas que crea sola la web: `web_likes`, `web_comments`, `web_images`, `web_tries`.

## Seguridad
- Secretos solo en `.env` / variables de Render (`.gitignore` los excluye). Si alguna vez subiste un `.env` a Git, cambia esas claves: borrarlo del repo no basta.
- Rotar `SESSION_SECRET` cierra todas las sesiones. El servidor no arranca con el valor de ejemplo.
- Crea un usuario MySQL solo para la web: SELECT en `player` y `crews`; SELECT/INSERT/DELETE en `discord_links`; todos los permisos solo en las tablas `web_*`.
- `MYSQL_SSL=1` cifra la conexión con la base de datos.
- Turnstile (opcional): define `TURNSTILE_SITEKEY` y `TURNSTILE_SECRET` para pedir verificación anti-bots al iniciar sesión.
- Login limitado por cuenta+IP (6) y por IP (30) cada 15 min; la API limita peticiones por IP.
- Cabeceras: CSP, HSTS, X-Frame-Options, Permissions-Policy. En HTTPS se fuerza la redirección desde HTTP.

## Interfaz
- Tema oscuro/claro y español/inglés (botones en el pie de página; se recuerdan en el navegador). Las publicaciones no se traducen.
- Nuevas secciones: Testimonios (los publica el staff, con su nombre y el texto real del jugador) y Contacto.
- Contacto: guarda los mensajes en la tabla `web_contact` (se crea sola). Solo el staff los ve y los borra. Máx. 3 mensajes por hora por IP; Turnstile se aplica aquí también si está activo.
- Página 404 propia: `public/404.html`.

## Avatares, staff por rangos y clasificación
- `SKIN_COLUMN` (por defecto `skin`): columna de la tabla `player` con el id de skin. `SKIN_URL` (opcional): imagen de cada skin, con `{id}` (ej. `/assets/skins/{id}.png` si las alojas tú). Si la imagen falla, se muestra la inicial.
- Staff agrupado por rango con avatar y "última vez"; nueva sección Clasificación (`/api/top`); noticias y fotos paginadas (12 por página).

## Estructura por páginas
Cada sección es una página independiente (archivo + URL propia), ya no van todas dentro de `index.html`:

| URL | HTML | JS de la página |
|---|---|---|
| `/` | `public/index.html` | `public/assets/js/pages/index.js` |
| `/noticias` | `public/noticias.html` | `public/assets/js/pages/noticias.js` |
| `/actualizaciones` | `public/actualizaciones.html` | `public/assets/js/pages/actualizaciones.js` |
| `/faq` | `public/faq.html` | `public/assets/js/pages/faq.js` |
| `/fotos` | `public/fotos.html` | `public/assets/js/pages/fotos.js` |
| `/staff` | `public/staff.html` | `public/assets/js/pages/staff.js` |
| `/solicitar-staff` | `public/solicitar-staff.html` | `public/assets/js/pages/solicitar-staff.js` |
| `/clasificacion` | `public/clasificacion.html` | `public/assets/js/pages/clasificacion.js` |
| `/reglas` | `public/reglas.html` | `public/assets/js/pages/reglas.js` |
| `/testimonios` | `public/testimonios.html` | `public/assets/js/pages/testimonios.js` |
| `/contacto` | `public/contacto.html` | `public/assets/js/pages/contacto.js` |
| `/comunidad` | `public/comunidad.html` | `public/assets/js/pages/comunidad.js` |
| `/perfil` | `public/perfil.html` | `public/assets/js/pages/perfil.js` |

- Lo compartido está en `public/assets/css/style.css`, `public/assets/js/core.js` (API, login, tema/idioma, menú) y `public/assets/js/sprite.js` (íconos).
- Para editar una página toca solo su `.html` y su `.js`. Si cambias CSS/JS, sube el `?v=1` de los `<link>`/`<script>` para evitar caché.
- Para crear una página nueva: copia un `.html`, cambia `data-v`, título y script; agrégala a `NAV` y `R` en `core.js` y a `ROUTES` en `server.js`.
- Los enlaces viejos tipo `/#fotos` redirigen solos a `/fotos`. Discord vuelve a `/perfil?discord=...`.

## Publicaciones con fotos, etiquetas e historias
- Quien tenga sesión publica desde "¿Qué estás pensando?" (hoja a pantalla completa): texto, hasta 4 fotos y etiquetas de jugadores (`/api/users/search`). Las fotos se reducen en el navegador.
- Historias: botón "Crear historia" en la franja del inicio. Una foto o un video MP4/MOV/WebM de **máx. 15 s** (el servidor lee la duración del archivo) y de `VIDEO_MAX_MB` MB (por defecto 25). Duran 24 h: al vencer se borran solas (cada hora) junto con sus medios, me gusta y comentarios. Se ven en el visor (toque derecho/izquierdo, mantener para pausar), con me gusta y comentarios, y aparecen en el feed con miniatura mientras estén activas.
- Medios nuevos (tablas `web_media`, `web_media_chunks`, `web_post_media`, `web_tags`; se crean solas): se guardan en la base de datos en trozos de 256 KB y se sirven en `/media/:id` con soporte de Range.
- Barra inferior del celular (`fbNav()` en `core.js`), como en Facebook: **Feed · Reels · Solicitudes de amistad · Marketplace · Notificaciones · Perfil**. El ícono de solicitudes muestra cuántas tienes pendientes.

## Notificaciones
- Nueva página `/notificaciones` (`public/notificaciones.html` + `public/assets/js/pages/notificaciones.js`) y campana con contador en la **barra inferior** del celular, en la cabecera (PC) y en el menú lateral/hamburguesa. El contador se actualiza solo cada 45 s.
- Avisan de: **me gusta** y **comentarios** en tus publicaciones/historias, **también comentó** (alguien comentó donde tú ya habías comentado), **menciones** `@Nombre_Apellido` en publicaciones y comentarios (al escribir `@` + 2 letras sale una lista de jugadores), **etiquetas** en publicaciones, **noticias y actualizaciones nuevas** del staff, **Discord vinculado** y, solo para el staff, **mensajes nuevos en Contacto**.
- En la lista: filtros Todas / No leídas, "Marcar todo como leído", menú ••• por aviso (marcar como leída / eliminar) y "Ver anteriores". Al tocar un aviso se marca como leído y te lleva a la publicación (si es un comentario se abre con los comentarios desplegados).
- Tabla nueva (se crea sola): `web_notifs`. Los avisos se borran con su publicación, al quitar el me gusta y a los 45 días. `NOTIF_BROADCAST_MAX` (opcional, por defecto 3000) limita a cuántos jugadores se avisa de una noticia/actualización.
- **Solicitudes de amistad:** ya implementadas (ver «Amigos»); usan los tipos `friend_req` y `friend_acc`. Cuando crees el sistema de amigos solo llama, en `server.js`:
  - al enviar la solicitud: `await notify(idDestino, u, "friend_req");`
  - al aceptarla: `await notify(idQuienLaEnvió, u, "friend_acc");`
  
  (`u` es el jugador que actúa, el que devuelve `me(req)`). Al tocar el aviso se abre el perfil de esa persona; si luego quieres botones Confirmar/Eliminar dentro del aviso, se añaden en `ntRow()` de `notificaciones.js`.
- Para otro tipo de aviso: llama `notify(destino, actor, "tipo", idPublicación, "texto corto")`, y agrega el texto y el ícono del tipo en `NTX` y `NIC` de `notificaciones.js` (y el color en `.ty[data-ty=...]` del CSS).

## Amigos
- Tabla nueva (se crea sola): `web_friends` (`a` envía, `b` recibe; `status` 0 = pendiente, 1 = amigos).
- Página `/amigos` (`public/amigos.html` + `public/assets/js/pages/amigos.js`): buscador, solicitudes recibidas (Confirmar/Eliminar), «Personas que quizás conozcas» (primero con amigos en común, luego los más activos) y mis amigos.
- Perfil `/u/Nombre`: botón Agregar a amigos / Cancelar solicitud / Confirmar-Eliminar / Amigos, contador y vista de amigos. Las solicitudes también se responden desde `/notificaciones`.
- El feed (`/feed` e inicio) y la franja de historias solo muestran publicaciones de tus amigos y las tuyas (`/api/posts?type=feed`, `scope=friends`). Sin amigos aparece un aviso con botón hacia `/amigos`. Noticias y actualizaciones siguen en sus páginas.
- API: `POST /api/friends/request`, `POST /api/friends/accept`, `DELETE /api/friends/:name`, `GET /api/friends`, `/api/friends/requests`, `/api/friends/suggestions`, `/api/friends/search?q=`.
- Permisos MySQL: la web necesita SELECT/INSERT/UPDATE/DELETE en `web_friends`.

## Reels, Marketplace y diseño tipo Facebook
- **Reels** (`/reels`: `public/reels.html` + `public/assets/js/pages/reels.js`): videos que sube la comunidad, a pantalla completa. Se desliza hacia arriba para ver el siguiente (se cargan solos de 8 en 8). A la derecha: me gusta, comentarios (hoja desde abajo), compartir, guardar y ••• (guardar, copiar enlace, ver perfil, eliminar). Un toque pausa (el primero activa el sonido), dos toques dan me gusta.
  - Se suben desde el botón ＋ de Reels o «Crear reel» del perfil: MP4/MOV/WebM de hasta `REEL_MAX_SECS` segundos (por defecto 90) y `REEL_MAX_MB` MB (por defecto 60), con barra de progreso. El servidor comprueba la duración leyendo el archivo.
  - Enlaces: `/reels?r=ID` abre ese reel primero (también `/p/ID`), `?u=Nombre` solo los de ese jugador, `?saved=1` tus guardados, `&c=1` abre los comentarios.
  - Los videos de reels se guardan como `kind = 'rel'` en `web_media` (no se pueden usar como historia de 15 s).
  - API: `GET /api/reels`, `POST /api/reels`, `POST /api/posts/:id/save`. Tabla nueva (se crea sola): `web_saved`. Permisos MySQL: SELECT/INSERT/DELETE en `web_saved`.
- **Marketplace** (`/marketplace`): por ahora muestra «Próximamente»; se conectará con el servidor de SA-MP cuando la función esté lista en el gamemode.
- **Solicitudes** (`/amigos`): filas como Facebook (foto grande, amigos en común con sus caras, «hace 16 sem», Confirmar/Eliminar), «Ver todas», pestañas Sugerencias / Tus amigos y buscador (lupa).
- **Notificaciones**: secciones Nuevas (sin leer) / Hoy / Anteriores; «Marcar todo como leído» y «Ver solo no leídas» están en el botón •••. Los avisos de reels abren el reel.
- **Perfil** (`/perfil` y `/u/Nombre`, función `perfilFB()` en `core.js`): portada, foto redonda, rango, amigos · publicaciones · reels, botones (Agregar a historia / Crear reel, o Agregar a amigos) y pestañas Todo · Reels · Fotos · Más (Amigos, Guardados). La sección **Resumen** muestra los datos de la cuenta: en tu perfil nivel, reputación, tiempo jugado, efectivo, banco, facción, teléfono, arrestos, registro, última conexión y Discord; en el de otros solo los datos públicos.

## Reels: rendimiento (videos que se traban o no cargan)
- En el celular solo hay 2-3 videos cargados a la vez (el que ves y sus vecinos); los demás se liberan. El siguiente empieza a cargarse cuando el actual ya está sonando. Al deslizar rápido no se cargan los que solo pasan por la pantalla.
- Si un video se queda quieto 5 s o falla la conexión, se vuelve a pedir desde donde iba (hasta 3 veces); después aparece «Toca para reintentar». Mientras carga se ve un círculo girando.
- Servidor: los MP4 se guardan con el índice al principio («faststart»), así empiezan a reproducirse sin bajar el final del archivo. Los trozos de video más vistos quedan en memoria (`MEDIA_CACHE_MB`, por defecto 96) y el navegador guarda los videos en su caché. La conexión a MySQL usa hasta `MYSQL_POOL` conexiones (por defecto 10).
- **Conversión con ffmpeg** (dependencia opcional `ffmpeg-static`, se instala con `npm install`; o `FFMPEG_PATH`, o el `ffmpeg` del sistema): los reels que pesan más de `REEL_MAX_KBPS` (por defecto 2500 kbps) o que no son MP4 se convierten en segundo plano a MP4 H.264 de máx. 1280 px (~2 Mbps). El reel sale al instante con el original y luego se cambia por el liviano; el original se borra a los 30 min. Se apaga con `REEL_TRANSCODE=0`. Al arrancar, el registro dice si ffmpeg está disponible.

## Guía del servidor (`/guia`)
- Buscador de comandos, trabajos, facciones, lugares, negocios, estacionamientos y guías, con "quizás quisiste decir", sinónimos y búsquedas relacionadas.
- Se actualiza sola: el gamemode (`gamemodes/src/guia.pwn` del repo Backup) vuelca cada vez que arranca sus comandos, trabajos, facciones y lugares en `guide_entries`; la web lo junta con `businesses` y `parkings` en vivo (caché de 2 min). Las guías escritas a mano están en `data/guia.json`.
- API: `GET /api/guia`, `POST /api/guia/busqueda` (registro de búsquedas, máx. 20 por minuto por IP), `GET /api/guia/sin-resultados` (staff: lo que la gente busca y no encuentra).
- Tabla nueva (se crea sola): `web_guide_searches`. Permisos MySQL: SELECT en `guide_entries`, `businesses`, `parkings` y `parking_spots`.

## Launcher de Android (prueba)
- La app SampCity (launcher de SA-MP para Android) consulta al abrirse `GET /api/launcher/distribution.json` (servidor y archivos del juego), `GET /api/launcher/news` (noticias y actualizaciones de la web) y `GET /api/launcher/donate`.
- El servidor sale de `LAUNCHER_SERVER` (por defecto `sv.sampcity.app:7781`; la web lo pasa a IP, que es lo que necesita el cliente).
- `data/launcher-cache.json` es la lista de archivos del juego (carpeta, nombre y tamaño). Solo se manda si `LAUNCHER_CDN` apunta a donde están subidos (p. ej. un bucket de Cloudflare R2); sin eso la app no descarga nada y usa los que ya haya en el teléfono.
- Opcionales: `LAUNCHER_VERSION` (si es mayor que la de la app, ofrece actualizarla) y `LAUNCHER_APK_URL` (dónde está el `.apk` nuevo).
