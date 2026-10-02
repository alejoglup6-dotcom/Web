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
