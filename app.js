// app.js — Lógica del lector, índice, modo oscuro, y 'API' para Google Maps
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null;
const scale = 1.1;

const canvas = document.getElementById('pdf-render');
const ctx = canvas.getContext('2d');
const pageNumElem = document.getElementById('page-num');
const pageCountElem = document.getElementById('page-count');
const indexEl = document.getElementById('pdf-index');
const msgEl = document.getElementById('pdf-message');

function renderPage(num){
  pageRendering = true;
  pdfDoc.getPage(num).then(function(page){
    const viewport = page.getViewport({scale});
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {canvasContext: ctx, viewport};
    const renderTask = page.render(renderContext);
    renderTask.promise.then(function(){
      pageRendering = false;
      if(pageNumPending !== null){
        renderPage(pageNumPending);pageNumPending = null;
      }
    });
    pageNumElem.textContent = num;
  });
}

function queueRenderPage(num){
  if(pageRendering){pageNumPending = num;} else {renderPage(num);} 
}

document.getElementById('prev-page').addEventListener('click',()=>{ if(pageNum<=1) return; pageNum--; queueRenderPage(pageNum); });
document.getElementById('next-page').addEventListener('click',()=>{ if(pageNum>=pdfDoc.numPages) return; pageNum++; queueRenderPage(pageNum); });

function loadPDFData(data){
  pdfjsLib.getDocument({data}).promise.then(function(pdf){
    pdfDoc = pdf; pageCountElem.textContent = pdf.numPages; pageNum=1; renderPage(pageNum); msgEl.style.display='none';
    // outline
    // Try to build a higher-level section index by scanning page text for headings
    async function generateSectionIndex(pdfDoc){
      const headings = [];
      const maxPages = pdfDoc.numPages;

      // Heuristics regex for likely section headings
      const headingRegex = /^(?:CAP[IÍ]TULO|Cap[ií]tulo|SECCI[OÓ]N|Secci[oó]n|INTRODUCCI[ÓO]N|Introducci[oó]n|ANEXO|Anexo|PARTE|Parte)\b|^[0-9]{1,2}\s*-\s*[A-ZÁÉÍÓÚÜÑ]|^[A-ZÁÉÍÓÚÑ\s]{5,}\b/;

      for(let p=1;p<=maxPages;p++){
        try{
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          // build lines by grouping text items by their y coordinate
          const items = content.items;
          const linesMap = new Map();
          items.forEach(it=>{
            // round y coordinate for grouping
            const y = Math.round((it.transform[5]));
            const prev = linesMap.get(y) || [];
            prev.push(it.str);
            linesMap.set(y, prev);
          });
          const lines = Array.from(linesMap.values()).map(arr=>arr.join(' '));
          // scan lines for a heading match
          for(const line of lines){
            const clean = line.trim();
            if(clean.length<4) continue;
            // prefer lines with uppercase or matching common section words
            if(headingRegex.test(clean) || (clean===clean.toUpperCase() && clean.length<80 && /[A-ZÑ]/.test(clean))){
              // avoid adding too-short noise
              if(!headings.find(h=>h.title===clean)){
                headings.push({title: clean, page: p});
              }
              break; // only first heading per page
            }
          }
          // stop early if we have many headings
          if(headings.length>=40) break;
        }catch(e){
          // ignore page read errors
        }
      }

      indexEl.innerHTML='';
      if(headings.length===0){
        // fallback to outline if no heuristics found
        const outline = await pdfDoc.getOutline();
        if(!outline || !outline.length){ indexEl.innerHTML = '<p class="muted">No hay índice en este PDF.</p>'; return; }
        const ul = document.createElement('div');
        outline.forEach(item=>{
          const row = document.createElement('div');
          row.className = 'index-row';
          const btn = document.createElement('button');
          btn.className = 'title-btn';
          btn.textContent = item.title || 'Sin título';
          row.dataset.title = (item.title || '').toLowerCase();
          btn.onclick = ()=>{
            if(item.dest){
              pdfDoc.getDestination(item.dest).then(dest => {
                pdfDoc.getPageIndex(dest[0]).then(idx=>{ pageNum = idx+1; queueRenderPage(pageNum); });
              });
            }
          };
          const pageSpan = document.createElement('span');
          pageSpan.className='page-span muted';
          pageSpan.textContent = '';
          row.appendChild(btn);
          row.appendChild(pageSpan);
          ul.appendChild(row);
        });
        indexEl.appendChild(ul);
        return;
      }

      // build simple index view: section name + starting page
      const list = document.createElement('div');
      headings.forEach(h=>{
        const row = document.createElement('div');
        row.className = 'index-row';
        row.dataset.title = (h.title || '').toLowerCase();
        const titleBtn = document.createElement('button');
        titleBtn.className = 'title-btn';
        titleBtn.textContent = h.title;
        titleBtn.onclick = ()=>{ pageNum = h.page; queueRenderPage(pageNum); };
        const pageSpan = document.createElement('span');
        pageSpan.className = 'page-span';
        pageSpan.textContent = h.page;
        row.appendChild(titleBtn);
        row.appendChild(pageSpan);
        list.appendChild(row);
      });
      indexEl.appendChild(list);
    }

    // Setup index search filter
    const searchInput = document.getElementById('index-search');
    if(searchInput){
      searchInput.addEventListener('input', (e)=>{
        const q = e.target.value.trim().toLowerCase();
        const rows = indexEl.querySelectorAll('.index-row');
        rows.forEach(r=>{
          const title = r.dataset.title || r.textContent.toLowerCase();
          r.style.display = q === '' || title.includes(q) ? 'flex' : 'none';
        });
      });
    }

    // Generate section index
    generateSectionIndex(pdf);
    
        // PDF text search implementation
        let pdfSearchResults = [];
        let pdfSearchIndex = 0;
        const pdfSearchInput = document.getElementById('pdf-search-input');
        const pdfSearchCount = document.getElementById('pdf-search-count');
        const pdfSearchPrev = document.getElementById('pdf-search-prev');
        const pdfSearchNext = document.getElementById('pdf-search-next');

        async function searchPdf(query){
          pdfSearchResults = [];
          pdfSearchIndex = 0;
          // show placeholder while searching
          pdfSearchCount.textContent = '0/0';
          if(!query || query.trim()===''){ pdfSearchCount.textContent = '0'; return; }
          const q = query.trim().toLowerCase();
          const max = pdf.numPages;
          for(let p=1;p<=max;p++){
            try{
              const page = await pdf.getPage(p);
              const content = await page.getTextContent();
              const text = content.items.map(it=>it.str).join(' ').toLowerCase();
              if(text.includes(q)) pdfSearchResults.push(p);
            }catch(e){/*ignore*/}
          }
          pdfSearchCount.textContent = pdfSearchResults.length.toString();
          if(pdfSearchResults.length>0){
            pdfSearchIndex = 0; pageNum = pdfSearchResults[0]; queueRenderPage(pageNum);
            // show current/total
            pdfSearchCount.textContent = (pdfSearchIndex+1) + '/' + pdfSearchResults.length;
          }
        }

        if(pdfSearchInput){
          let searchTimeout = null;
          pdfSearchInput.addEventListener('input',(e)=>{
            const q = e.target.value;
            if(searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(()=> searchPdf(q), 350);
          });
        }

        if(pdfSearchPrev){
          pdfSearchPrev.addEventListener('click', ()=>{
            if(pdfSearchResults.length===0) return;
            pdfSearchIndex = (pdfSearchIndex - 1 + pdfSearchResults.length) % pdfSearchResults.length;
            pageNum = pdfSearchResults[pdfSearchIndex]; queueRenderPage(pageNum);
            pdfSearchCount.textContent = (pdfSearchIndex+1) + '/' + pdfSearchResults.length;
          });
        }
        if(pdfSearchNext){
          pdfSearchNext.addEventListener('click', ()=>{
            if(pdfSearchResults.length===0) return;
            pdfSearchIndex = (pdfSearchIndex + 1) % pdfSearchResults.length;
            pageNum = pdfSearchResults[pdfSearchIndex]; queueRenderPage(pageNum);
            pdfSearchCount.textContent = (pdfSearchIndex+1) + '/' + pdfSearchResults.length;
          });
        }
  }).catch(err=>{ msgEl.textContent = 'Error al leer el PDF: '+err.message; msgEl.style.display='block'; });
}

// Cargar el PDF oficial servido por el endpoint fijo
function loadOfficialPdf(){
  // Intent: prefer /api/school (for server), but if we're hosted as static site (GitHub Pages),
  // fall back to /school.json in the repo root.
  function populateSchool(data){
    schoolInfo = data;
    const el = document.getElementById('school-info');
    // short address shown in sidebar; allow server to provide shortAddress
    const fullAddress = (data.address || '').trim();
    const shortAddr = data.shortAddress || fullAddress.split('\n')[0] || fullAddress;
    el.innerHTML = `<strong>${data.name}</strong><br/><span class="muted">${shortAddr}</span>`;
    // Inserta el mapa incrustado usando las coordenadas (sin API key)
    try{
      const lat = encodeURIComponent(data.lat);
      const lng = encodeURIComponent(data.lng);
      const mapDiv = document.getElementById('map-embed');
      const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
      mapDiv.innerHTML = `<iframe title="Mapa de la escuela" src="${src}" style="border:0;width:100%;height:100%;" loading="lazy"></iframe>`;
      // populate overlay with concise info and show
      const overlay = document.getElementById('map-overlay');
      if(overlay){
        overlay.innerHTML = `<h5>${data.name}</h5><p>${shortAddr}</p>`;
        overlay.style.display = 'block';
      }
    }catch(e){
      // ignore
    }
  }

  // Try server endpoint first
  fetch('/api/school').then(r=>{
    if(!r.ok) throw new Error('No se pudo obtener /api/school');
    return r.json();
  }).then(data=>populateSchool(data)).catch(()=>{
    // fallback to static school.json (works on GitHub Pages)
    fetch('/school.json').then(r=>{
      if(!r.ok) throw new Error('No se pudo obtener school.json');
      return r.json();
    }).then(data=>populateSchool(data)).catch(()=>{
      document.getElementById('school-info').textContent = 'No se encontró la info.';
    });
  });
  if(!btn) return;
  btn.classList.add('title-btn');
}
styleToggleLikeIndex();

// Try to use /logo.png if the user placed it; fallback to existing src otherwise
try{
  const logoImg = document.getElementById('site-logo');
  if(logoImg){
    fetch('/logo.png', {method: 'HEAD'}).then(res=>{
      if(res && res.ok){ logoImg.src = '/logo.png'; }
    }).catch(()=>{/* ignore */});
  }
}catch(e){/* ignore */}

// 'API' para Google Maps: cargamos school.json y construimos URL
let schoolInfo = null;

function loadSchool(){
  // Consumir el endpoint /api/school para obtener la info (en lugar de school.json local)
  fetch('/api/school').then(r=>{
    if(!r.ok) throw new Error('No se pudo obtener /api/school');
    return r.json();
  }).then(data=>{
    schoolInfo = data;
    const el = document.getElementById('school-info');
    // Show a concise one-line address in the sidebar (keep full address on the overlay if needed)
    const fullAddress = (data.address || '').trim();
    const shortAddr = data.shortAddress || fullAddress.split('\n')[0] || fullAddress;
    el.innerHTML = `<strong>${data.name}</strong><br/><span class="muted">${shortAddr}</span>`;
    // Inserta el mapa incrustado usando las coordenadas (sin API key)
    try{
      const lat = encodeURIComponent(data.lat);
      const lng = encodeURIComponent(data.lng);
      const mapDiv = document.getElementById('map-embed');
      const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
      mapDiv.innerHTML = `<iframe title="Mapa de la escuela" src="${src}" style="border:0;width:100%;height:100%;" loading="lazy"></iframe>`;
      // populate overlay with concise info and show
      const overlay = document.getElementById('map-overlay');
      if(overlay){
        // overlay shows name and short address
        overlay.innerHTML = `<h5>${data.name}</h5><p>${shortAddr}</p>`;
        overlay.style.display = 'block';
      }
    }catch(e){
      // ignore
    }
  }).catch(()=>{
    document.getElementById('school-info').textContent = 'No se encontró la info.';
  });
}
loadSchool();

document.getElementById('open-maps').addEventListener('click', ()=>{
  if(!schoolInfo){ alert('Info de la escuela no cargada.'); return; }
  const lat = schoolInfo.lat, lng = schoolInfo.lng;
  // Usamos la URL de Google Maps con query
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.open(url, '_blank');
});

// Download PDF button behavior: fetch and trigger download (works across browsers)
const downloadBtn = document.getElementById('download-pdf');
if(downloadBtn){
  downloadBtn.addEventListener('click', async ()=>{
    try{
      const resp = await fetch('/manual/manual.pdf');
      if(!resp.ok) throw new Error('No se pudo obtener el PDF.');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manual-escolar.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }catch(err){
      alert('Error al descargar el PDF: '+err.message);
    }
  });
}
