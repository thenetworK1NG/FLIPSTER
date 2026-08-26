import {
    pageConfig, pagePanelVisible,
    setPageConfig, setPagePanelVisible,
    getAnimationClips, getCurrentModel
} from './state.js';
import { generateThumbnail, createPaperTexture } from './textures.js';
import { getAllPageClips, getPrimaryPageName, extractPageIndex, getOrderedPageClips } from './animation.js';
import { openEditor, getCollageData } from './editor.js';

export function findPageMeshes() {
    const currentModel = getCurrentModel();
    const animationClips = getAnimationClips();
    if (!currentModel || !animationClips) return [];
    const allPageClips = getAllPageClips();
    const results = [];
    for (const clip of allPageClips) {
        const pageName = getPrimaryPageName(clip);
        if (!pageName) continue;
        const node = currentModel.getObjectByName(pageName);
        if (!node) continue;
        const meshes = [];
        node.traverse(child => {
            if (child.isMesh) meshes.push(child);
        });
        if (meshes.length > 0) {
            results.push({ name: pageName, node, meshes, clip });
        }
    }
    return results;
}

export function initPageConfig() {
    const animationClips = getAnimationClips();
    if (!animationClips || !getCurrentModel()) return;
    const pageMeshes = findPageMeshes();
    const newPageConfig = [];
    pageMeshes.forEach((pm) => {
        pm.meshes.forEach((mesh, mi) => {
            const paperTexture = createPaperTexture();
            if (mesh.material) {
                mesh.material.map = paperTexture;
                mesh.material.needsUpdate = true;
            }
            const meshLabel = pm.meshes.length > 1
                ? `${pm.name} ${mi === 0 ? 'Front' : 'Back'}`
                : pm.name;
            newPageConfig.push({
                id: `${pm.name}_${mi}`,
                name: meshLabel,
                clip: pm.clip,
                meshNode: pm.node,
                mesh: mesh,
                visible: true,
                customTexture: null,
                defaultTexture: paperTexture,
                thumbnail: generateThumbnail(paperTexture),
                order: newPageConfig.length
            });
        });
    });
    setPageConfig(newPageConfig);
    buildPagePanelUI();
}

export function applyPageConfig() {
    for (const pc of pageConfig) {
        if (pc.mesh) {
            pc.mesh.visible = pc.visible;
        }
        if (pc.mesh && pc.mesh.material) {
            const tex = pc.customTexture || pc.defaultTexture;
            pc.mesh.material.map = tex;
            pc.mesh.material.needsUpdate = true;
        }
    }
}

const svgEdit = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9H2v-3l9-9z"/></svg>';
const svgReset = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 1 1 1.5 4"/><polyline points="2 12 2 8 6 8"/></svg>';

export function buildPagePanelUI() {
    const list = document.getElementById('pageList');
    if (!list) return;
    list.innerHTML = '';
    const sorted = [...pageConfig].sort((a, b) => a.order - b.order);
    sorted.forEach((pc, displayIndex) => {
        const item = document.createElement('div');
        item.className = 'page-item' + (pc.visible ? '' : ' hidden-page');
        item.dataset.pageId = pc.id;

        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', pc.id);
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            list.querySelectorAll('.page-item').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const fromId = e.dataTransfer.getData('text/plain');
            const toId = pc.id;
            if (fromId && fromId !== toId) {
                reorderPages(fromId, toId);
            }
        });

        const handle = document.createElement('span');
        handle.className = 'page-drag-handle';
        handle.textContent = '\u2261';

        const idx = document.createElement('span');
        idx.className = 'page-index';
        idx.textContent = displayIndex + 1;

        const thumb = document.createElement('img');
        thumb.className = 'page-thumbnail';
        thumb.src = pc.thumbnail || '';
        thumb.alt = pc.name;
        if (!pc.thumbnail) {
            thumb.style.background = 'var(--bg-elevated)';
        }

        const name = document.createElement('span');
        name.className = 'page-name';
        name.textContent = pc.name;

        const hoverActions = document.createElement('div');
        hoverActions.className = 'page-hover-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'page-hover-btn';
        editBtn.title = 'Edit collage';
        editBtn.innerHTML = svgEdit;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditor(pc.id);
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'page-hover-btn btn-danger';
        resetBtn.title = 'Reset image';
        resetBtn.innerHTML = svgReset;
        resetBtn.style.display = pc.customTexture ? 'flex' : 'none';
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pc.customTexture = null;
            if (pc.mesh && pc.defaultTexture) {
                pc.mesh.material.map = pc.defaultTexture;
                pc.mesh.material.needsUpdate = true;
            }
            pc.thumbnail = generateThumbnail(pc.defaultTexture);
            buildPagePanelUI();
        });

        hoverActions.appendChild(editBtn);
        hoverActions.appendChild(resetBtn);

        const toggle = document.createElement('label');
        toggle.className = 'page-toggle';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = pc.visible;
        checkbox.addEventListener('change', () => {
            pc.visible = checkbox.checked;
            item.classList.toggle('hidden-page', !pc.visible);
            applyPageConfig();
            updatePageCount();
        });
        const slider = document.createElement('span');
        slider.className = 'slider';
        toggle.appendChild(checkbox);
        toggle.appendChild(slider);

        item.appendChild(handle);
        item.appendChild(idx);
        item.appendChild(thumb);
        item.appendChild(name);
        item.appendChild(hoverActions);
        item.appendChild(toggle);
        list.appendChild(item);
    });
    updatePageCount();
}

export function updatePageCount() {
    const footer = document.getElementById('pagePanelFooter');
    if (!footer) return;
    const visible = pageConfig.filter(p => p.visible).length;
    const total = pageConfig.length;
    const custom = pageConfig.filter(p => p.customTexture).length;
    let text = `${visible} of ${total} pages`;
    if (custom > 0) text += ` \u00b7 ${custom} custom`;
    footer.textContent = text;

    const countBadge = document.getElementById('pagePanelCount');
    if (countBadge) countBadge.textContent = total;
}

function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
}

export function togglePagePanel() {
    const next = !pagePanelVisible;
    setPagePanelVisible(next);
    const panel = document.getElementById('pageConfigPanel');
    if (panel) {
        if (isMobile()) {
            panel.classList.toggle('mobile-open', next);
        } else {
            panel.classList.toggle('open', next);
        }
    }
    const backdrop = document.getElementById('mobileBackdrop');
    if (backdrop) {
        backdrop.classList.toggle('visible', isMobile() && next);
    }
}

export function reorderPages(fromId, toId) {
    const fromIdx = pageConfig.findIndex(p => p.id === fromId);
    const toIdx = pageConfig.findIndex(p => p.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = pageConfig.splice(fromIdx, 1);
    pageConfig.splice(toIdx, 0, moved);
    pageConfig.forEach((pc, i) => pc.order = i);
    buildPagePanelUI();
}

export function selectAllPages() {
    pageConfig.forEach(pc => pc.visible = true);
    applyPageConfig();
    buildPagePanelUI();
}

export function hideAllPages() {
    pageConfig.forEach(pc => pc.visible = false);
    applyPageConfig();
    buildPagePanelUI();
}

export function resetAllImages() {
    pageConfig.forEach(pc => {
        pc.customTexture = null;
        if (pc.mesh && pc.defaultTexture) {
            pc.mesh.material.map = pc.defaultTexture;
            pc.mesh.material.needsUpdate = true;
        }
    });
    buildPagePanelUI();
}

export async function exportScrapbook() {
    const ZIP = window.JSZip;
    if (!ZIP) { alert('JSZip not loaded'); return; }

    const exportBtn = document.getElementById('exportScrapbookBtn');
    if (exportBtn) {
        exportBtn.classList.add('loading');
        exportBtn.disabled = true;
        exportBtn.querySelector('span').textContent = 'Exporting...';
    }

    try {
        const zip = new ZIP();
        const collageData = getCollageData();
        const sorted = [...pageConfig].sort((a, b) => a.order - b.order);
        const pagesDir = zip.folder('pages');
        const metadata = { version: 1, pages: [] };

        for (const pc of sorted) {
            if (!pc.customTexture) continue;
            const tex = pc.customTexture;
            const src = tex.image;
            let blob;
            if (src instanceof HTMLCanvasElement) {
                blob = await new Promise(r => src.toBlob(r, 'image/png'));
            } else if (src instanceof HTMLImageElement) {
                const c = document.createElement('canvas');
                c.width = src.naturalWidth || src.width;
                c.height = src.naturalHeight || src.height;
                c.getContext('2d').drawImage(src, 0, 0);
                blob = await new Promise(r => c.toBlob(r, 'image/png'));
            } else {
                continue;
            }
            const fname = `pages/${pc.id}.png`;
            zip.file(fname, blob);
            const pageMeta = {
                id: pc.id,
                order: pc.order,
                visible: pc.visible,
                textureFile: fname
            };
            const cd = collageData[pc.id];
            if (cd) {
                pageMeta.bgColor = cd.bgColor;
                pageMeta.elements = cd.elements;
            }
            metadata.pages.push(pageMeta);
        }

        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        try {
            const glbResp = await fetch('book.glb');
            if (glbResp.ok) {
                zip.file('book.glb', await glbResp.blob());
            }
        } catch (e) {}

        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = 'scrapbook.zip';
        a.click();
        URL.revokeObjectURL(a.href);

        if (exportBtn) {
            exportBtn.querySelector('span').textContent = 'Done!';
            setTimeout(() => {
                exportBtn.classList.remove('loading');
                exportBtn.disabled = false;
                exportBtn.querySelector('span').textContent = 'Export ZIP';
            }, 1500);
        }
    } catch (err) {
        console.error('Export failed:', err);
        if (exportBtn) {
            exportBtn.classList.remove('loading');
            exportBtn.disabled = false;
            exportBtn.querySelector('span').textContent = 'Export ZIP';
        }
    }
}
