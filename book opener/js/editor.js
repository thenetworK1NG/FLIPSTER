import * as THREE from 'three';
import { pageConfig, setPageConfig } from './state.js';
import { generateThumbnail } from './textures.js';
import { buildPagePanelUI } from './page-config.js';

let editorOverlay = null;
let editorCanvas = null;
let editorBgEl = null;
let editorDropZone = null;
let fileInput = null;
let currentTargetPageId = null;
let collageElements = [];
let selectedEl = null;
let nextZIndex = 1;
let bgColor = '#ffffff';

const pageCollageData = {};

export function getCollageData() { return pageCollageData; }

export function getCollageElementsForPage(pageId) {
    return pageCollageData[pageId] || null;
}

const EDITOR_W = 390;
const EDITOR_H = 596;
const SCALE = 3;
const CANVAS_W = EDITOR_W * SCALE;
const CANVAS_H = EDITOR_H * SCALE;

export function initEditor() {
    editorOverlay = document.getElementById('editorOverlay');
    editorCanvas = document.getElementById('editorCanvas');
    editorBgEl = document.getElementById('editorBg');
    editorDropZone = document.getElementById('editorDropZone');
    fileInput = document.getElementById('editorFileInput');

    if (!editorOverlay || !editorCanvas) return;

    editorCanvas.addEventListener('click', (e) => {
        if (e.target === editorCanvas || e.target === editorBgEl) {
            deselectAll();
        }
    });

    editorCanvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        editorDropZone.classList.add('active');
    });
    editorCanvas.addEventListener('dragleave', () => {
        editorDropZone.classList.remove('active');
    });
    editorCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        editorDropZone.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files) {
            for (const file of files) {
                if (file.type.startsWith('image/')) addImageFromFile(file);
            }
        }
    });

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files) {
                for (const file of files) {
                    if (file.type.startsWith('image/')) addImageFromFile(file);
                }
            }
            fileInput.value = '';
        });
    }

    document.getElementById('editorAddImage')?.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });

    document.getElementById('editorDelete')?.addEventListener('click', deleteSelected);
    document.getElementById('editorForward')?.addEventListener('click', bringForward);
    document.getElementById('editorBack')?.addEventListener('click', sendBack);
    document.getElementById('editorSave')?.addEventListener('click', saveCollage);
    document.getElementById('editorClose')?.addEventListener('click', closeEditor);
    document.getElementById('editorClear')?.addEventListener('click', clearCollage);

    const bgPicker = document.getElementById('editorBgColor');
    if (bgPicker) {
        bgPicker.addEventListener('input', (e) => {
            bgColor = e.target.value;
            if (editorBgEl) editorBgEl.style.background = bgColor;
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!editorOverlay || !editorOverlay.classList.contains('open')) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement === document.body || document.activeElement === editorCanvas) {
                deleteSelected();
            }
        }
        if (e.key === 'Escape') {
            closeEditor();
        }
    });
}

export function openEditor(pageId) {
    currentTargetPageId = pageId;
    collageElements = [];
    selectedEl = null;
    nextZIndex = 1;
    bgColor = '#ffffff';

    editorCanvas.querySelectorAll('.collage-el').forEach(el => el.remove());

    const saved = pageCollageData[pageId];
    if (saved) {
        bgColor = saved.bgColor || '#ffffff';
        if (editorBgEl) editorBgEl.style.background = bgColor;
        const bgPicker = document.getElementById('editorBgColor');
        if (bgPicker) bgPicker.value = bgColor;
        saved.elements.forEach(el => {
            addImageToCanvas(el.src, el.x, el.y, el.w, el.h);
            const wrapper = editorCanvas.querySelector('.collage-el:last-child');
            if (wrapper) {
                wrapper.style.zIndex = el.zIndex;
                wrapper.style.transform = `rotate(${el.rotation}deg)`;
            }
        });
    } else {
        if (editorBgEl) editorBgEl.style.background = bgColor;
        const bgPicker = document.getElementById('editorBgColor');
        if (bgPicker) bgPicker.value = bgColor;
        const pc = pageConfig.find(p => p.id === pageId);
        if (pc && pc.customTexture && pc.customTexture.image) {
            addImageFromCanvas(pc.customTexture.image, 0, 0, EDITOR_W, EDITOR_H);
        }
    }

    editorOverlay.classList.add('open');
}

function closeEditor() {
    editorOverlay.classList.remove('open');
    currentTargetPageId = null;
    deselectAll();
}

function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const scale = Math.min(EDITOR_W / w, EDITOR_H / h, 1) * 0.7;
            w *= scale;
            h *= scale;
            const x = (EDITOR_W - w) / 2;
            const y = (EDITOR_H - h) / 2;
            addImageToCanvas(reader.result, x, y, w, h);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function addImageFromCanvas(imgSource, x, y, w, h) {
    addImageToCanvas(imgSource, x, y, w, h);
}

function addImageToCanvas(src, x, y, w, h) {
    const wrapper = document.createElement('div');
    wrapper.className = 'collage-el';
    wrapper.style.left = x + 'px';
    wrapper.style.top = y + 'px';
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';
    wrapper.style.zIndex = nextZIndex++;

    const img = document.createElement('img');
    img.src = src;
    img.draggable = false;
    wrapper.appendChild(img);

    const handles = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
    handles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle ' + pos;
        handle.dataset.handle = pos;
        wrapper.appendChild(handle);
    });

    const rotHandle = document.createElement('div');
    rotHandle.className = 'rotate-handle';
    wrapper.appendChild(rotHandle);

    const label = document.createElement('span');
    label.className = 'rotate-label';
    wrapper.appendChild(label);

    setupElementDrag(wrapper);
    setupResize(wrapper);
    setupRotate(wrapper, rotHandle, label);

    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
        e.stopPropagation();
        selectElement(wrapper);
    });
    wrapper.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
        e.stopPropagation();
        selectElement(wrapper);
    }, { passive: true });

    editorCanvas.appendChild(wrapper);
    collageElements.push({ wrapper, src });
    selectElement(wrapper);
}

function selectElement(el) {
    deselectAll();
    selectedEl = el;
    el.classList.add('selected');
}

function deselectAll() {
    editorCanvas.querySelectorAll('.collage-el.selected').forEach(el => el.classList.remove('selected'));
    selectedEl = null;
}

function deleteSelected() {
    if (!selectedEl) return;
    selectedEl.remove();
    collageElements = collageElements.filter(c => c.wrapper !== selectedEl);
    selectedEl = null;
}

function bringForward() {
    if (!selectedEl) return;
    const cur = parseInt(selectedEl.style.zIndex) || 1;
    selectedEl.style.zIndex = cur + 1;
}

function sendBack() {
    if (!selectedEl) return;
    const cur = parseInt(selectedEl.style.zIndex) || 1;
    selectedEl.style.zIndex = Math.max(1, cur - 1);
}

function clearCollage() {
    editorCanvas.querySelectorAll('.collage-el').forEach(el => el.remove());
    collageElements = [];
    selectedEl = null;
}

function setupElementDrag(el) {
    let startX, startY, startLeft, startTop;
    let dragging = false;

    const onPointerDown = (e) => {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
        if (e.button && e.button !== 0) return;
        dragging = true;
        startX = e.clientX || (e.touches && e.touches[0].clientX);
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        startLeft = parseFloat(el.style.left);
        startTop = parseFloat(el.style.top);
        el.style.cursor = 'grabbing';
        selectElement(el);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
    };

    const onPointerMove = (e) => {
        if (!dragging) return;
        const cx = e.clientX;
        const cy = e.clientY;
        el.style.left = (startLeft + cx - startX) + 'px';
        el.style.top = (startTop + cy - startY) + 'px';
    };

    const onPointerUp = () => {
        dragging = false;
        el.style.cursor = 'move';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    };

    el.addEventListener('pointerdown', onPointerDown);
}

function setupResize(el) {
    el.querySelectorAll('.resize-handle').forEach(handle => {
        let startX, startY, startW, startH, startLeft, startTop;
        let resizing = false;
        const pos = handle.dataset.handle;

        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = parseFloat(el.style.width);
            startH = parseFloat(el.style.height);
            startLeft = parseFloat(el.style.left);
            startTop = parseFloat(el.style.top);

            const onMove = (e) => {
                if (!resizing) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newW = startW;
                let newH = startH;
                let newL = startLeft;
                let newT = startTop;

                if (pos.includes('r')) newW = Math.max(30, startW + dx);
                if (pos.includes('l')) { newW = Math.max(30, startW - dx); newL = startLeft + (startW - newW); }
                if (pos.includes('b')) newH = Math.max(30, startH + dy);
                if (pos.includes('t') && pos !== 'tr' && pos !== 'tl') { newH = Math.max(30, startH - dy); newT = startTop + (startH - newH); }
                if (pos === 'tl') { newH = Math.max(30, startH - dy); newT = startTop + (startH - newH); }
                if (pos === 'tr') { newH = Math.max(30, startH - dy); newT = startTop + (startH - newH); }

                const aspect = startW / startH;
                if (e.shiftKey) {
                    if (pos === 'br' || pos === 'tl') {
                        newH = newW / aspect;
                    } else if (pos === 'bl' || pos === 'tr') {
                        newH = newW / aspect;
                    } else if (pos.includes('r') || pos.includes('l')) {
                        newH = newW / aspect;
                    } else {
                        newW = newH * aspect;
                    }
                }

                el.style.width = newW + 'px';
                el.style.height = newH + 'px';
                el.style.left = newL + 'px';
                el.style.top = newT + 'px';
            };

            const onUp = () => {
                resizing = false;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    });
}

function setupRotate(el, handle, label) {
    let startAngle = 0;
    let startRotation = 0;
    let rotating = false;

    const getRotation = () => {
        const t = el.style.transform || '';
        const match = t.match(/rotate\(([-\d.]+)deg\)/);
        return match ? parseFloat(match[1]) : 0;
    };

    handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        rotating = true;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        startRotation = getRotation();

        const onMove = (e) => {
            if (!rotating) return;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
            let rot = startRotation + (angle - startAngle);
            if (e.shiftKey) {
                rot = Math.round(rot / 15) * 15;
            }
            el.style.transform = `rotate(${rot}deg)`;
            if (label) label.textContent = Math.round(rot) + '\u00b0';
        };

        const onUp = () => {
            rotating = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    });
}

function saveCollage() {
    if (!currentTargetPageId) return;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const elements = editorCanvas.querySelectorAll('.collage-el');
    const sorted = Array.from(elements).sort((a, b) => {
        return (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0);
    });

    let loadCount = 0;
    let totalImages = 0;
    const imagesToDraw = [];

    sorted.forEach(el => {
        const img = el.querySelector('img');
        if (!img) return;
        totalImages++;
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        const w = parseFloat(el.style.width);
        const h = parseFloat(el.style.height);
        const t = el.style.transform || '';
        const rotMatch = t.match(/rotate\(([-\d.]+)deg\)/);
        const rot = rotMatch ? parseFloat(rotMatch[1]) : 0;

        imagesToDraw.push({ img, x, y, w, h, rot });
    });

    if (totalImages === 0) {
        finishSave(canvas);
        return;
    }

    let loaded = 0;
    imagesToDraw.forEach(item => {
        if (item.img.complete && item.img.naturalWidth > 0) {
            loaded++;
            if (loaded === totalImages) drawAll(ctx, imagesToDraw, canvas);
        } else {
            item.img.onload = () => {
                loaded++;
                if (loaded === totalImages) drawAll(ctx, imagesToDraw, canvas);
            };
        }
    });
}

function drawAll(ctx, items, canvas) {
    items.forEach(item => {
        ctx.save();
        const cx = (item.x + item.w / 2) * SCALE;
        const cy = (item.y + item.h / 2) * SCALE;
        ctx.translate(cx, cy);
        ctx.rotate(item.rot * Math.PI / 180);
        ctx.drawImage(item.img, -item.w * SCALE / 2, -item.h * SCALE / 2, item.w * SCALE, item.h * SCALE);
        ctx.restore();
    });
    finishSave(canvas);
}

function finishSave(canvas) {
    const flipped = document.createElement('canvas');
    flipped.width = canvas.width;
    flipped.height = canvas.height;
    const fctx = flipped.getContext('2d');
    fctx.translate(0, canvas.height);
    fctx.scale(1, -1);
    fctx.drawImage(canvas, 0, 0);

    const texture = new THREE.CanvasTexture(flipped);
    texture.needsUpdate = true;

    const pc = pageConfig.find(p => p.id === currentTargetPageId);
    if (pc) {
        pc.customTexture = texture;
        pc.thumbnail = generateThumbnail(texture);
        if (pc.mesh) {
            pc.mesh.material.map = texture;
            pc.mesh.material.needsUpdate = true;
        }
    }

    const elements = editorCanvas.querySelectorAll('.collage-el');
    const sorted = Array.from(elements).sort((a, b) => {
        return (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0);
    });
    const savedElements = sorted.map(el => {
        const img = el.querySelector('img');
        const t = el.style.transform || '';
        const rotMatch = t.match(/rotate\(([-\d.]+)deg\)/);
        return {
            src: img ? img.src : '',
            x: parseFloat(el.style.left) || 0,
            y: parseFloat(el.style.top) || 0,
            w: parseFloat(el.style.width) || 0,
            h: parseFloat(el.style.height) || 0,
            rotation: rotMatch ? parseFloat(rotMatch[1]) : 0,
            zIndex: parseInt(el.style.zIndex) || 0
        };
    });
    pageCollageData[currentTargetPageId] = {
        bgColor: bgColor,
        elements: savedElements
    };

    buildPagePanelUI();
    closeEditor();
}
