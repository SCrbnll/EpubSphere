import './style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import JSZip from 'jszip';

document.querySelector('#app').innerHTML = `
    <div class="drop-zone" id="dropZone">
      <p>Arrastra un archivo EPUB aquí o haz clic para cargar</p>
      <input type="file" id="fileInput" accept=".epub" />
    </div>
    <div id="content">
      <p>Sube el archivo epub para cargar el contenido.</p>
    </div>
    <div class="button">
      <button class="btn btn-primary" id="clearButton">Cargar otro libro</button>
    </div>
`;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const contentDiv = document.getElementById('content');
const clearButton = document.getElementById('clearButton');

window.addEventListener('load', () => {
  const savedScrollPosition = localStorage.getItem('scrollPosition');
  const savedContent = localStorage.getItem('contentDiv');
  
  if (savedContent !== null && savedContent !== '<p>Sube el archivo epub para cargar el contenido.</p>') {
    contentDiv.innerHTML = savedContent;
    dropZone.classList.add('hidden');
  }

  if (savedScrollPosition) {
    contentDiv.scrollTo(0, savedScrollPosition);
  }
});

contentDiv.addEventListener('scroll', () => {
  localStorage.setItem('scrollPosition', contentDiv.scrollTop);
  localStorage.setItem('contentDiv', contentDiv.innerHTML);
});

clearButton.addEventListener('click', () => {
  dropZone.classList.remove('hidden');
  contentDiv.innerHTML = `<p>Sube el archivo epub para cargar el contenido.</p>`;
  localStorage.removeItem('scrollPosition');
  localStorage.removeItem('contentDiv'); 
  console.log(localStorage)
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.style.backgroundColor = '#f0f0ff';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.backgroundColor = 'transparent';
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.style.backgroundColor = 'transparent';
  const file = event.dataTransfer.files[0];
  if (file) {
    loadEpub(file);
  }
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    loadEpub(file);
  }
});

async function loadEpub(file) {
  contentDiv.innerHTML = `<p>Procesando el archivo: ${file.name}...</p>`;
  dropZone.classList.add('hidden');

  const zip = new JSZip();
  try {
    const loadedZip = await zip.loadAsync(file);
    
    const contentFile = Object.keys(loadedZip.files).find((path) =>
      path.toLowerCase().endsWith('content.opf')
    );

    if (contentFile) {
      const contentOpf = await loadedZip.file(contentFile).async('text');
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(contentOpf, 'application/xml');
      const manifestItems = xmlDoc.querySelectorAll('manifest item');

      const htmlFiles = Array.from(manifestItems)
        .filter((item) => item.getAttribute('media-type') === 'application/xhtml+xml')
        .map((item) => item.getAttribute('href'));

      if (htmlFiles.length) {
        renderChapters(loadedZip, htmlFiles);
      } else {
        contentDiv.innerHTML = '<p>No se encontraron capítulos para mostrar.</p>';
      }
    } else {
      contentDiv.innerHTML = '<p>No se encontró el archivo content.opf en el EPUB.</p>';
    }
  } catch (error) {
    contentDiv.innerHTML = `<p>Error al cargar el archivo: ${error.message}</p>`;
  }
}

async function renderChapters(zip, htmlFiles) {
  contentDiv.innerHTML = '<h4>Contenido del EPUB:</h4><div id="chapters"></div>';
  const chaptersDiv = document.getElementById('chapters');

  for (const htmlFile of htmlFiles) {
    try {
      const resolvedPath = resolvePath(zip, htmlFile);

      const file = zip.file(resolvedPath);
      if (!file) {
        console.warn(`Archivo no encontrado: ${resolvedPath}`);
        continue;
      }

      const htmlContent = await file.async('text');
      chaptersDiv.innerHTML += `<div class="chapter">${htmlContent}</div><hr>`;
    } catch (error) {
      console.error(`Error al cargar el capítulo ${htmlFile}:`, error);
    }
  }

  function resolvePath(zip, relativePath) {
    const normalizedPath = relativePath.replace(/^\//, '');
    return Object.keys(zip.files).find((path) => path.endsWith(normalizedPath)) || normalizedPath;
  }
}
