import * as THREE from 'three';
import {
    pageConfig, pagePanelVisible,
    setPageConfig, setPagePanelVisible,
    getAnimationClips, getCurrentModel
} from './state.js';
import { generateThumbnail, createPaperTexture } from './textures.js';
import { getAllPageClips, getPrimaryPageName, extractPageIndex, getOrderedPageClips } from './animation.js';

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

export function buildPagePanelUI() {
    const list = document.getElementById('pageList');
    if (!list) return;
    list.innerHTML = '';
    const sorted = [...pageConfig].sort((a, b) => a.order - b.order);
    sorted.forEach((pc, displayIndex) => {
        const item = document.createElement('div');
        item.className = 'page-item' + (pc.visible ? '' : ' hidden-page');
        item.dataset.pageId = pc.id;

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
            thumb.style.background = 'rgba(255,255,255,0.12)';
        }

        const name = document.createElement('span');
        name.className = 'page-name';
        name.textContent = pc.name;

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
    footer.textContent = `${visible} of ${total} pages`;
}

export function togglePagePanel() {
    const next = !pagePanelVisible;
    setPagePanelVisible(next);
    const content = document.getElementById('pagePanelContent');
    if (content) {
        content.classList.toggle('open', next);
    }
}

export async function importScrapbookFromData(metadata, pagesMap) {
    for (const meta of metadata.pages) {
        const pc = pageConfig.find(p => p.id === meta.id);
        if (!pc) continue;
        pc.visible = meta.visible !== false;
        pc.order = meta.order;
        if (meta.textureFile && pagesMap[meta.textureFile]) {
            const blob = pagesMap[meta.textureFile];
            const url = URL.createObjectURL(blob);
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const texture = new THREE.CanvasTexture(canvas);
                    texture.needsUpdate = true;
                    pc.customTexture = texture;
                    pc.thumbnail = generateThumbnail(texture);
                    if (pc.mesh) {
                        pc.mesh.material.map = texture;
                        pc.mesh.material.needsUpdate = true;
                    }
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.onerror = resolve;
                img.src = url;
            });
        }
    }
    applyPageConfig();
    buildPagePanelUI();
}
