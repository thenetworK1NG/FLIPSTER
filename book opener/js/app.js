import { initViewer } from './viewer.js';
import { loadGLB } from './loader.js';
import { importScrapbookFromData } from './page-config.js';
import { importScrapbookZip } from './storage.js';

window.addEventListener('DOMContentLoaded', () => {
    const loaderEl = document.getElementById('loaderOverlay');
    if (loaderEl) { loaderEl.classList.add('hide'); loaderEl.style.display = 'none'; }

    const landing = document.getElementById('landingOverlay');
    const fileInput = document.getElementById('scrapbookFileInput');
    const dropZone = document.getElementById('dropZone');
    const fileBtn = document.getElementById('browseBtn');
    const statusEl = document.getElementById('landingStatus');

    fileBtn?.addEventListener('click', () => fileInput.click());

    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });
    dropZone?.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
        fileInput.value = '';
    });

    async function handleFile(file) {
        if (!file.name.endsWith('.zip')) {
            if (statusEl) statusEl.textContent = 'Please select a .zip file';
            return;
        }
        if (statusEl) statusEl.textContent = 'Loading scrapbook...';
        try {
            const { metadata, pagesMap, modelBlob } = await importScrapbookZip(file);

            landing.classList.add('hide');
            setTimeout(() => { landing.style.display = 'none'; }, 1500);

            initViewer();

            if (modelBlob) {
                const buffer = await modelBlob.arrayBuffer();
                await loadGLB(buffer);
            } else {
                await loadGLB('book.glb');
            }

            await importScrapbookFromData(metadata, pagesMap);

        } catch (err) {
            console.error('Failed to open scrapbook:', err);
            if (statusEl) statusEl.textContent = 'Failed to open: ' + err.message;
        }
    }
});
