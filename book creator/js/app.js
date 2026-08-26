import { initViewer } from './viewer.js';
import { isMobileDevice, formatCameraSnippet } from './utils.js';
import { cameraInfoEl } from './state.js';
import { togglePagePanel, selectAllPages, hideAllPages, resetAllImages, exportScrapbook } from './page-config.js';
import { initEditor } from './editor.js';

window.addEventListener('DOMContentLoaded', () => {
    initViewer();
    initEditor();

    const camInfo = cameraInfoEl;
    if (camInfo) {
        if (isMobileDevice()) {
            camInfo.addEventListener('click', () => {
                try {
                    const txt = camInfo.textContent || '';
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
                } catch (e) {}
            }, { passive: true });
        }
        camInfo.addEventListener('click', (ev) => {
            const el = ev.target;
            if (el && el.id === 'copyCamBtn') {
                try {
                    const snippet = formatCameraSnippet();
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(snippet);
                } catch (e) {}
            }
        });
    }

    document.getElementById('togglePagePanel')?.addEventListener('click', togglePagePanel);
    document.getElementById('panelBackBtn')?.addEventListener('click', () => {
        const panel = document.getElementById('pageConfigPanel');
        if (panel && (panel.classList.contains('mobile-open') || panel.classList.contains('open'))) {
            togglePagePanel();
        }
    });

    document.getElementById('showAllPages')?.addEventListener('click', selectAllPages);
    document.getElementById('hideAllPages')?.addEventListener('click', hideAllPages);
    document.getElementById('resetAllImages')?.addEventListener('click', resetAllImages);
    document.getElementById('exportScrapbookBtn')?.addEventListener('click', exportScrapbook);

    const fab = document.getElementById('mobileFab');
    const panel = document.getElementById('pageConfigPanel');
    const backdrop = document.getElementById('mobileBackdrop');

    if (fab) {
        fab.addEventListener('click', () => {
            togglePagePanel();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            const panelEl = document.getElementById('pageConfigPanel');
            if (panelEl && (panelEl.classList.contains('mobile-open') || panelEl.classList.contains('open'))) {
                togglePagePanel();
            }
        });
    }

    const headerHint = document.getElementById('headerHint');
    if (headerHint) {
        if (isMobileDevice()) {
            headerHint.textContent = 'Tap pages to interact';
        } else {
            headerHint.textContent = 'Space for animations \u00b7 Drag pages to interact';
        }
    }
});
