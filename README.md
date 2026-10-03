# SampCity Web

1. `cp .env.example .env` y rellena los datos (base de datos, SESSION_SECRET, Discord).
2. `npm install` y `npm start`.
3. En el Discord Developer Portal (OAuth2) agrega el redirect: `https://TU-DOMINIO/auth/discord/callback`.

- Login: usa el mismo nombre y contraseña del juego (bcrypt o SHA256+sal, como snrp.pwn).
- La web solo crea la tabla `web_posts`; las demás (`player`, `discord_links`, `crews`) ya existen y solo se leen,
  salvo `discord_links`, donde se inserta/borra la vinculación.
- Noticias/actualizaciones/FAQ: las publica quien tenga `admin_level` >= POST_MIN_LEVEL.

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
- Barra inferior: se quitaron Feed y Cámara; se agregaron Videos y Marketplace (por ahora muestran "Próximamente"). Cuando existan esas páginas, quita el atributo `data-soon` en `fbNav()` (`core.js`) y registra las rutas en `ROUTES`.

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
