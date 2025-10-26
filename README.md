# Manual Escolar — Sitio de ejemplo

Pequeña aplicación estática para visualizar un manual en PDF (con índice), abrir la ubicación en Google Maps, modo oscuro, página de desarrolladores y galería.

Cómo usar

1. Ejecutar el servidor Express incluido para asegurarse de que el PDF oficial se sirva desde un endpoint fijo y de que la API devuelva la metadata.

 2. El servidor espera que pongas el PDF oficial en `public/manual.pdf`. No hay opción para subir PDFs en el cliente: el visor sólo carga `/manual/manual.pdf`. Si no existe, crea la carpeta `public` y copia allí tu PDF oficial con el nombre exacto `manual.pdf`:

3. Abrir `http://localhost:3000/index.html` en un navegador moderno (recomendado: Chrome o Edge).

4. El índice (si el PDF tiene outline) aparecerá en la barra lateral y puedes navegar por las páginas.
5. `developers.html` muestra 3 perfiles y `gallery.html` tiene una galería de ejemplo.

Notas técnicas

- Implementación cliente usando PDF.js (CDN). No necesita servidor para funciones básicas.
- Si prefieres servir los archivos localmente con un servidor (para evitar restricciones del navegador), ejecuta en PowerShell desde la carpeta `school-manual`:

```powershell
# Windows PowerShell: instalar dependencias y levantar el servidor Express incluido
cd 'C:\Users\north\Documents\school-manual'
npm install
 # Copia tu PDF oficial a public\manual.pdf

 Añadir el logo de la escuela

 Si quieres que aparezca el logo real en el header, coloca la imagen proporcionada en:

 `C:\Users\north\Documents\school-manual\public\logo.png`

 El proyecto incluye un `public/logo.svg` placeholder que se mostrará si no reemplazas el archivo. Puedes usar PNG o SVG; si usas otro nombre, modifica el atributo `src` del elemento `#site-logo` en `index.html`.
node server.js
# luego abrir http://localhost:3000/index.html
```

Personalización

- Reemplaza `school.json` con las coordenadas reales o cambia `name`/`address`.
- Cambia las imágenes en `gallery.html` por tus propias imágenes.

Licencia

Este proyecto es de ejemplo; úsalo y modifícalo libremente.
