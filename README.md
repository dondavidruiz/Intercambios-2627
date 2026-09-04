# Gestión de Intercambios 26/27 — CRFPTIC

Dashboard público (cualquiera con el enlace puede ver y filtrar los 51 centros)
con una ficha de gestión por centro que solo los administradores del programa
pueden abrir y editar (coordinador, teléfono, fechas, memorias, incidencias).

- **El sitio** (`index.html`, `style.css`, `app.js`, `data.js`) se sube a tu
  GitHub y se publica con GitHub Pages, exactamente como el dashboard anterior.
- **Los datos de gestión** (los que se editan en cada ficha) se guardan en
  **Firestore** (base de datos gratuita de Google/Firebase), protegidos por
  una contraseña real de administrador — no en un archivo del propio
  repositorio, para que no queden expuestos públicamente.
- El catálogo público (nombre del centro, provincia, destinos, importe...) se
  queda tal cual en `data.js`, igual que antes.

Tiempo estimado de configuración inicial: **15-20 minutos**, una sola vez.

---

## 1. Crear el proyecto de Firebase (gratis, sin tarjeta de crédito)

1. Entra en <https://console.firebase.google.com> con una cuenta Google (puede
   ser una cuenta de equipo/departamental).
2. **Añadir proyecto** → ponle un nombre, por ejemplo `intercambios-crfptic`.
   No hace falta activar Google Analytics.
3. Cuando el proyecto esté creado, en el menú lateral entra en
   **Compilación → Firestore Database** → **Crear base de datos**.
   - Elige una ubicación europea (por ejemplo `eur3 (europe-west)`).
   - Modo: **producción** (no "modo de prueba").
4. Ve a la pestaña **Reglas** de Firestore, borra lo que haya y pega el
   contenido completo del archivo [`firestore.rules`](./firestore.rules) de
   esta carpeta. Pulsa **Publicar**.
   - Esto es lo que de verdad protege los datos: sin sesión iniciada con la
     clave de administrador, nadie puede leer ni escribir la colección
     `centros` (ni siquiera abriendo las herramientas de desarrollador del
     navegador).

## 2. Activar el inicio de sesión y crear la clave de administrador

1. Menú lateral → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Sign-in method** → habilita el proveedor **Correo
   electrónico/contraseña** (Email/Password) → Guardar.
3. Pestaña **Users** → **Add user**:
   - Correo: usa el mismo valor que aparece en `firebase-config.js`
     (`admin@intercambios-crfptic.local` por defecto — puedes dejarlo así, es
     un correo técnico interno, nadie del equipo necesita escribirlo).
   - Contraseña: **esta es la clave de administrador** que compartiréis en el
     equipo. Elige una contraseña robusta.
4. Cuando queráis cambiar la clave más adelante, volved a esta pantalla y
   usad el menú ⋮ de ese usuario → **Restablecer contraseña**, o borrad el
   usuario y creadlo de nuevo con otra contraseña.

## 3. Copiar la configuración del proyecto al código

1. Menú lateral → icono de engranaje ⚙ → **Configuración del proyecto**.
2. Baja hasta **Tus apps** → icono **`</>`** (Web) → dale un nombre (p.ej.
   "dashboard") → **Registrar app** (no hace falta Firebase Hosting).
3. Copia el objeto `firebaseConfig` que te muestra y pégalo en el archivo
   [`firebase-config.js`](./firebase-config.js) de esta carpeta, sustituyendo
   los valores de ejemplo (`PEGA_AQUI_TU_...`).
4. Guarda el archivo. No pasa nada por subir estas claves a un repositorio
   público: Firebase está diseñado así, la protección real la dan las reglas
   del paso 1 y el usuario del paso 2, no el secreto de esta configuración.

## 4. Subir el sitio a GitHub Pages

1. En tu repositorio de GitHub (el mismo que usasteis para el dashboard
   anterior, o uno nuevo), sube **todos** los archivos de esta carpeta:
   `index.html`, `style.css`, `app.js`, `data.js`, `firebase-config.js`
   (con tus claves ya pegadas), `firestore.rules` y este `README.md`.
2. En GitHub → **Settings → Pages** → en "Build and deployment" elige
   **Deploy from a branch**, rama `main` (o `master`), carpeta `/ (root)` →
   **Save**.
3. Al cabo de uno o dos minutos, GitHub te da la URL pública
   (`https://<tu-usuario>.github.io/<tu-repo>/`). Esa es la URL que puede
   abrir cualquiera para ver y filtrar el listado.

## 5. Probarlo

1. Abre la URL pública: deberías ver el dashboard igual que antes, con el
   botón **"🔒 Acceso administrador"** arriba a la derecha.
2. Pulsa el botón, escribe la clave de administrador (la contraseña del
   paso 2) y pulsa Entrar.
3. Con la sesión iniciada, haz clic en cualquier ficha: se abrirá el
   formulario editable. Rellena algo y pulsa **Guardar cambios**.
4. Cierra la ficha y ábrela de nuevo (o recarga la página estando logado):
   los datos deben seguir ahí. Eso confirma que Firestore está guardando
   correctamente.
5. Prueba también el botón **"⬇ Descargar datos"** (solo visible logado).

---

## Teléfonos de los centros

El teléfono de cada centro se muestra directamente en la ficha (solo
lectura, no hace falta teclearlo) cruzando el código de centro con
`listadoCentrosSecundaria.csv`. Encajó para 50 de los 51 centros; el único
que no aparecía con su código oficial en ese csv —Colegio SAGRADO CORAZÓN
(León)— lo confirmó el equipo a mano.

## Cómo funciona por dentro

- **Ver y filtrar** el listado no requiere ninguna cuenta ni contraseña:
  todo el catálogo público vive directamente en `data.js`.
- **Abrir una ficha** pide la clave de administrador. Esa clave inicia sesión
  de verdad contra Firebase Authentication (no es una comprobación "de
  mentira" en el propio JavaScript): sin la contraseña correcta, Firestore
  rechaza tanto la lectura como la escritura de las fichas, aunque alguien
  intente saltarse la pantalla mirando el código de la página.
- **Todos los administradores comparten la misma clave** (no hay cuentas
  individuales). Es cómodo, pero significa que si alguien deja el equipo lo
  correcto es rotar la contraseña (paso 2.4).
- **Ediciones simultáneas**: si dos personas guardan la misma ficha casi a la
  vez, gana el último guardado (no hay control de versiones). Si alguien más
  actualiza una ficha mientras la tienes abierta, verás un aviso.
- **El botón de descarga** exporta en PDF o XLS los centros que cumplen los
  filtros activos en ese momento, con las columnas que marques. El DNI queda
  sin marcar por defecto para evitar incluirlo sin querer en un archivo que
  luego se comparta.

## Aviso sobre datos personales (RGPD/LOPD)

Esta ficha guarda datos personales del coordinador (nombre, correo y, si se
rellena, DNI). El teléfono que se muestra es el del centro, un dato oficial
público del directorio de centros, no un dato personal. Aunque los datos del
coordinador quedan protegidos por la clave de administrador y no son
públicos, sigue siendo responsabilidad del centro de formación:

- Informar a los coordinadores de qué datos suyos se guardan y con qué
  finalidad (gestión del programa de intercambios).
- Permitir que ejerzan sus derechos de acceso, rectificación y supresión.
- Rotar la clave de administrador si cambia el equipo que gestiona el
  programa.

## Actualizar el catálogo público (nuevo curso, correcciones)

Edita el array `PUBLICOS` / `CONCERTADOS` en `data.js` (nombre, código,
provincia, puntuación, importe, destinos) y vuelve a subir el archivo a
GitHub. Los datos de gestión de Firestore no se ven afectados por estos
cambios, salvo que cambies el código de un centro (en ese caso su ficha
antigua queda "huérfana" en Firestore; puedes borrarla a mano desde la
consola de Firebase si quieres limpiarla).

## Coste

Todo lo usado aquí (Firestore + Authentication, plan "Spark") es gratuito
para este volumen de uso (una cincuentena de centros, un puñado de
administradores). No hace falta añadir ninguna tarjeta de crédito.
