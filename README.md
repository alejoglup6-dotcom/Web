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
