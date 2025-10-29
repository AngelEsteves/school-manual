// Simple Express server to serve the manual PDF and a small API endpoint
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Carpeta pública: aquí el administrador debe poner `manual.pdf` dentro de `public/manual.pdf`
app.use(express.static(path.join(__dirname, 'public')));

// Servir también los archivos estáticos del proyecto (index.html, styles.css, app.js, etc.)
// Esto facilita el desarrollo local: /index.html será accesible.
app.use(express.static(path.join(__dirname)));

// Endpoint para devolver metadata de la escuela
app.get('/api/school', (req, res) => {
  res.json({
    name: 'Escuela Básica Nacional Bolivariana "Antonia Esteller"',
    // Dirección concisa y directa para mostrar en la UI
    address: 'Calle "C" s/n, entre Barrios 11 de Abril e Independencia, Parroquia Madre María de San José, Municipio Girardot, Estado Aragua.',
    lat: 10.24931984381476,
    lng: -67.57797930503759
  });
});

// Ruta alternativa para el PDF (asegura ruta fija)
app.get('/manual/manual.pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'public', 'manual.pdf');
  res.sendFile(pdfPath, err => {
    if(err){
      res.status(404).send('PDF oficial no encontrado. Coloca el archivo en public/manual.pdf');
    }
  });
});

app.listen(port, ()=> console.log(`Server running on http://localhost:${port}`));
