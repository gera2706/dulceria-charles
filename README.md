# 🍬 Dulcería Charles

Tienda de dulces en línea — proyecto integrado. Frontend en HTML/CSS/JS vanilla, backend en Node.js + Express + MySQL.

## Guía de instalación

Todo lo que necesitas instalar y configurar para correr el proyecto en tu computadora.

### 1. Requisitos previos

Instala esto antes de tocar el proyecto:

| Programa | Para qué sirve | Dónde descargarlo |
|---|---|---|
| **Node.js** (v18 o superior) | Corre el servidor backend (Express) | https://nodejs.org (elige la versión LTS) |
| **MySQL Server** (8.x) | Guarda productos, usuarios, pedidos, etc. | https://dev.mysql.com/downloads/mysql/ |
| **MySQL Workbench** | Interfaz gráfica para crear la base de datos (opcional pero recomendado) | https://dev.mysql.com/downloads/workbench/ |
| **Git** | Para clonar el repositorio | https://git-scm.com/downloads |

npm (el gestor de paquetes de Node) ya viene incluido con Node.js — no se instala aparte.

### 2. Clonar el repositorio

```bash
git clone https://github.com/gera2706/dulceria-charles.git
cd dulceria-charles
```

### 3. Crear la base de datos

1. Abre **MySQL Workbench** y conéctate a tu servidor local.
2. Abre el archivo `dulceria_charles.sql` (está en la raíz del proyecto) y ejecútalo completo (⚡ o Ctrl+Shift+Enter).
3. Esto crea la base `dulceria_charles` con las 7 tablas necesarias, más datos de ejemplo: el usuario administrador y 107 productos.

⚠️ Este script borra la base de datos si ya existía y la crea desde cero — solo úsalo la primera vez o cuando quieras reiniciar todo.

### 4. Instalar las dependencias del backend

```bash
cd backend
npm install
```

Esto instala automáticamente todos los paquetes que el servidor necesita (Express, MySQL2, JWT, bcrypt, etc.) — están listados en `backend/package.json`, no hay que instalarlos uno por uno.

### 5. Configurar las variables de entorno

1. Dentro de `backend/`, copia el archivo `.env.example` y renómbralo a `.env`.
2. Ábrelo y llena estos valores:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=       ← tu contraseña de MySQL (la que usas para entrar a Workbench)
DB_NAME=dulceria_charles

JWT_SECRET=         ← genera una con el comando de abajo
PORT=3000
FRONTEND_ORIGIN=http://localhost:3000
```

3. Para generar un `JWT_SECRET` seguro, corre esto en la terminal y copia el resultado:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

**Este archivo `.env` nunca se sube a GitHub** (está en `.gitignore` a propósito, porque contiene tu contraseña de base de datos).

### 6. Iniciar el servidor

Desde la carpeta `backend/`:

```bash
npm start
```

Deberías ver algo como:
```
🍬 Dulcería Charles API corriendo en http://localhost:3000
```

(Si vas a modificar el código del backend seguido, usa `npm run dev` en su lugar — reinicia el servidor solo cada vez que guardas un archivo.)

### 7. Abrir el sitio

Abre tu navegador en **http://localhost:3000** — un solo servidor sirve tanto el sitio (desde `public/`) como la API.

### 8. Iniciar sesión como administrador

- **Correo:** `admin@dulceriacharles.com`
- **Contraseña:** `admin123`

Cámbiala desde "Mi cuenta" en cuanto entres, sobre todo si el proyecto sale de tu computadora.

## Estructura del proyecto

```
dulceria-charles/
├── public/               ← Frontend (HTML, CSS, JS, imágenes)
├── backend/              ← Servidor Express + rutas de la API
│   ├── routes/            ← Un archivo por grupo de endpoints
│   ├── middleware/         ← Verificación de sesión (JWT)
│   └── .env               ← Tus credenciales locales (no se sube a git)
└── dulceria_charles.sql  ← Esquema completo de la base de datos
```
