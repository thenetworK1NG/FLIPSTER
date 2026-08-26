import * as THREE from 'three';
import { pageConfig, setPageConfig } from './state.js';
import { generateThumbnail } from './textures.js';
import { buildPagePanelUI } from './page-config.js';

let editorOverlay = null;
let editorCanvas = null;
let editorBgEl = null;
let editorDropZone = null;
let editorEmptyState = null;
let editorSelectionToolbar = null;
let fileInput = null;
let currentTargetPageId = null;
let collageElements = [];
let selectedEl = null;
let nextZIndex = 1;
let bgColor = '#ffffff';

const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

const pageCollageData = {};

function getCanvasScale() {
    if (!editorCanvas) return 1;
    const rect = editorCanvas.getBoundingClientRect();
    return rect.width / EDITOR_W;
}

export function getCollageData() { return pageCollageData; }

export function getCollageElementsForPage(pageId) {
    return pageCollageData[pageId] || null;
}

const EDITOR_W = 390;
const EDITOR_H = 596;
const SCALE = 3;
const CANVAS_W = EDITOR_W * SCALE;
const CANVAS_H = EDITOR_H * SCALE;

function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function fitEditorCanvas() {
    if (!editorCanvas) return;
    if (!isMobile()) {
        editorCanvas.style.transform = '';
        editorCanvas.style.marginBottom = '';
        return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
    const primaryToolbar = document.querySelector('.editor-toolbar');
    const primaryH = primaryToolbar ? primaryToolbar.offsetHeight : 56;
    const secondaryBar = document.querySelector('.editor-toolbar-secondary');
    const secondaryH = (secondaryBar && secondaryBar.classList.contains('open')) ? secondaryBar.offsetHeight : 0;
    if (secondaryBar && secondaryBar.classList.contains('open')) {
        secondaryBar.style.bottom = primaryH + 'px';
    }
    const toolbarH = primaryH + secondaryH;
    const maxW = vw * 0.92;
    const maxH = vh - toolbarH - safeTop - 8;
    const factor = Math.min(maxW / EDITOR_W, maxH / EDITOR_H, 1);
    editorCanvas.style.transform = `scale(${factor})`;
    editorCanvas.style.marginBottom = toolbarH + 'px';
}

export function initEditor() {
    editorOverlay = document.getElementById('editorOverlay');
    editorCanvas = document.getElementById('editorCanvas');
    editorBgEl = document.getElementById('editorBg');
    editorDropZone = document.getElementById('editorDropZone');
    editorEmptyState = document.getElementById('editorEmptyState');
    editorSelectionToolbar = document.getElementById('editorSelectionToolbar');
    fileInput = document.getElementById('editorFileInput');

    if (!editorOverlay || !editorCanvas) return;

    window.addEventListener('resize', fitEditorCanvas);

    editorCanvas.addEventListener('click', (e) => {
        if (e.target === editorCanvas || e.target === editorBgEl) {
            deselectAll();
            const secondaryBar = document.querySelector('.editor-toolbar-secondary');
            if (secondaryBar && secondaryBar.classList.contains('open')) {
                secondaryBar.classList.remove('open');
                const moreBtn = document.getElementById('editorToolbarMore');
                if (moreBtn) moreBtn.classList.remove('active');
                fitEditorCanvas();
            }
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
    document.getElementById('editorBackBtn')?.addEventListener('click', closeEditor);
    document.getElementById('editorClear')?.addEventListener('click', clearCollage);
    document.getElementById('editorUndo')?.addEventListener('click', undo);
    document.getElementById('editorRedo')?.addEventListener('click', redo);

    const moreBtn = document.getElementById('editorToolbarMore');
    const secondaryBar = document.querySelector('.editor-toolbar-secondary');
    if (moreBtn && secondaryBar) {
        moreBtn.addEventListener('click', () => {
            const isOpen = secondaryBar.classList.toggle('open');
            moreBtn.classList.toggle('active', isOpen);
            fitEditorCanvas();
        });
    }

    document.getElementById('selForward')?.addEventListener('click', bringForward);
    document.getElementById('selBack')?.addEventListener('click', sendBack);
    document.getElementById('selDelete')?.addEventListener('click', deleteSelected);
    document.getElementById('selDuplicate')?.addEventListener('click', duplicateSelected);

    const bgPicker = document.getElementById('editorBgColor');
    if (bgPicker) {
        bgPicker.addEventListener('input', (e) => {
            bgColor = e.target.value;
            if (editorBgEl) editorBgEl.style.background = bgColor;
            pushSnapshot();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!editorOverlay || !editorOverlay.classList.contains('open')) return;

        const isMod = e.ctrlKey || e.metaKey;

        if (isMod && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
            return;
        }

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

function updateEmptyState() {
    if (editorEmptyState) {
        editorEmptyState.classList.toggle('hidden', collageElements.length > 0);
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('editorUndo');
    const redoBtn = document.getElementById('editorRedo');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function pushSnapshot() {
    const snapshot = serializeState();
    undoStack.push(snapshot);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoButtons();
}

function serializeState() {
    const elements = editorCanvas.querySelectorAll('.collage-el');
    const sorted = Array.from(elements).sort((a, b) => {
        return (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0);
    });
    return {
        bgColor,
        nextZIndex,
        elements: sorted.map(el => {
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
        })
    };
}

function restoreSnapshot(snapshot) {
    editorCanvas.querySelectorAll('.collage-el').forEach(el => el.remove());
    collageElements = [];
    selectedEl = null;
    bgColor = snapshot.bgColor || '#ffffff';
    nextZIndex = snapshot.nextZIndex || 1;

    if (editorBgEl) editorBgEl.style.background = bgColor;
    const bgPicker = document.getElementById('editorBgColor');
    if (bgPicker) bgPicker.value = bgColor;

    snapshot.elements.forEach(el => {
        addImageToCanvas(el.src, el.x, el.y, el.w, el.h, false);
        const wrapper = editorCanvas.querySelector('.collage-el:last-child');
        if (wrapper) {
            wrapper.style.zIndex = el.zIndex;
            wrapper.style.transform = `rotate(${el.rotation}deg)`;
            if (el.zIndex >= nextZIndex) nextZIndex = el.zIndex + 1;
        }
    });

    updateEmptyState();
    updateSelectionToolbar();
}

function undo() {
    if (undoStack.length === 0) return;
    const current = serializeState();
    redoStack.push(current);
    const prev = undoStack.pop();
    restoreSnapshot(prev);
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    const current = serializeState();
    undoStack.push(current);
    const next = redoStack.pop();
    restoreSnapshot(next);
    updateUndoRedoButtons();
}

function updateSelectionToolbar() {
    if (!editorSelectionToolbar) return;
    if (selectedEl) {
        editorSelectionToolbar.style.display = 'flex';
        const rect = selectedEl.getBoundingClientRect();
        const canvasRect = editorCanvas.getBoundingClientRect();
        const selW = editorSelectionToolbar.offsetWidth || 120;
        let left = rect.left - canvasRect.left + (rect.width - selW) / 2;
        let top = rect.top - canvasRect.top - 40;
        left = Math.max(0, Math.min(left, canvasRect.width - selW));
        if (top < 0) top = rect.bottom - canvasRect.top + 8;
        editorSelectionToolbar.style.left = left + 'px';
        editorSelectionToolbar.style.top = top + 'px';
    } else {
        editorSelectionToolbar.style.display = 'none';
    }
}

export function openEditor(pageId) {
    currentTargetPageId = pageId;
    collageElements = [];
    selectedEl = null;
    nextZIndex = 1;
    bgColor = '#ffffff';
    undoStack.length = 0;
    redoStack.length = 0;

    editorCanvas.querySelectorAll('.collage-el').forEach(el => el.remove());

    const saved = pageCollageData[pageId];
    if (saved) {
        bgColor = saved.bgColor || '#ffffff';
        if (editorBgEl) editorBgEl.style.background = bgColor;
        const bgPicker = document.getElementById('editorBgColor');
        if (bgPicker) bgPicker.value = bgColor;
        saved.elements.forEach(el => {
            addImageToCanvas(el.src, el.x, el.y, el.w, el.h, false);
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
            addImageFromCanvas(pc.customTexture.image, 0, 0, EDITOR_W, EDITOR_H, false);
        }
    }

    updateEmptyState();
    updateSelectionToolbar();
    updateUndoRedoButtons();
    fitEditorCanvas();
    editorOverlay.classList.add('open');
    requestAnimationFrame(fitEditorCanvas);
}

function closeEditor() {
    editorOverlay.classList.remove('open');
    const secondaryBar = document.querySelector('.editor-toolbar-secondary');
    if (secondaryBar) secondaryBar.classList.remove('open');
    const moreBtn = document.getElementById('editorToolbarMore');
    if (moreBtn) moreBtn.classList.remove('active');
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
            addImageToCanvas(reader.result, x, y, w, h, true);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function addImageFromCanvas(imgSource, x, y, w, h, recordSnapshot = true) {
    addImageToCanvas(imgSource, x, y, w, h, recordSnapshot);
}

function addImageToCanvas(src, x, y, w, h, recordSnapshot = true) {
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

    setupElementDrag(wrapper, recordSnapshot);
    setupResize(wrapper, recordSnapshot);
    setupRotate(wrapper, rotHandle, label, recordSnapshot);

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
    updateEmptyState();

    if (recordSnapshot) pushSnapshot();
}

function selectElement(el) {
    deselectAll();
    selectedEl = el;
    el.classList.add('selected');
    updateSelectionToolbar();
}

function deselectAll() {
    editorCanvas.querySelectorAll('.collage-el.selected').forEach(el => el.classList.remove('selected'));
    selectedEl = null;
    updateSelectionToolbar();
}

function deleteSelected() {
    if (!selectedEl) return;
    pushSnapshot();
    selectedEl.remove();
    collageElements = collageElements.filter(c => c.wrapper !== selectedEl);
    selectedEl = null;
    updateEmptyState();
    updateSelectionToolbar();
}

function duplicateSelected() {
    if (!selectedEl) return;
    const img = selectedEl.querySelector('img');
    if (!img) return;
    const x = (parseFloat(selectedEl.style.left) || 0) + 20;
    const y = (parseFloat(selectedEl.style.top) || 0) + 20;
    const w = parseFloat(selectedEl.style.width) || 100;
    const h = parseFloat(selectedEl.style.height) || 100;
    addImageToCanvas(img.src, x, y, w, h, true);
}

function bringForward() {
    if (!selectedEl) return;
    const cur = parseInt(selectedEl.style.zIndex) || 1;
    selectedEl.style.zIndex = cur + 1;
    pushSnapshot();
}

function sendBack() {
    if (!selectedEl) return;
    const cur = parseInt(selectedEl.style.zIndex) || 1;
    selectedEl.style.zIndex = Math.max(1, cur - 1);
    pushSnapshot();
}

function clearCollage() {
    if (collageElements.length === 0) return;
    pushSnapshot();
    editorCanvas.querySelectorAll('.collage-el').forEach(el => el.remove());
    collageElements = [];
    selectedEl = null;
    updateEmptyState();
    updateSelectionToolbar();
}

function setupElementDrag(el, recordSnapshot) {
    let startX, startY, startLeft, startTop;
    let dragging = false;
    let didMove = false;

    const onPointerDown = (e) => {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
        if (e.button && e.button !== 0) return;
        dragging = true;
        didMove = false;
        startX = e.clientX;
        startY = e.clientY;
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
        const scale = getCanvasScale();
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) didMove = true;
        el.style.left = (startLeft + dx) + 'px';
        el.style.top = (startTop + dy) + 'px';
        updateSelectionToolbar();
    };

    const onPointerUp = () => {
        dragging = false;
        el.style.cursor = 'move';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        if (didMove && recordSnapshot) pushSnapshot();
    };

    el.addEventListener('pointerdown', onPointerDown);
}

function setupResize(el, recordSnapshot) {
    el.querySelectorAll('.resize-handle').forEach(handle => {
        let startX, startY, startW, startH, startLeft, startTop;
        let resizing = false;
        let didMove = false;
        const pos = handle.dataset.handle;

        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            resizing = true;
            didMove = false;
            startX = e.clientX;
            startY = e.clientY;
            startW = parseFloat(el.style.width);
            startH = parseFloat(el.style.height);
            startLeft = parseFloat(el.style.left);
            startTop = parseFloat(el.style.top);

            const onMove = (e) => {
                if (!resizing) return;
                const scale = getCanvasScale();
                const dx = (e.clientX - startX) / scale;
                const dy = (e.clientY - startY) / scale;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) didMove = true;
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
                updateSelectionToolbar();
            };

            const onUp = () => {
                resizing = false;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                if (didMove && recordSnapshot) pushSnapshot();
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    });
}

function setupRotate(el, handle, label, recordSnapshot) {
    let startAngle = 0;
    let startRotation = 0;
    let rotating = false;
    let didMove = false;

    const getRotation = () => {
        const t = el.style.transform || '';
        const match = t.match(/rotate\(([-\d.]+)deg\)/);
        return match ? parseFloat(match[1]) : 0;
    };

    handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        rotating = true;
        didMove = false;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        startRotation = getRotation();

        const onMove = (e) => {
            if (!rotating) return;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
            let rot = startRotation + (angle - startAngle);
            if (Math.abs(rot - startRotation) > 1) didMove = true;
            if (e.shiftKey) {
                rot = Math.round(rot / 15) * 15;
            }
            el.style.transform = `rotate(${rot}deg)`;
            if (label) label.textContent = Math.round(rot) + '\u00b0';
            updateSelectionToolbar();
        };

        const onUp = () => {
            rotating = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (didMove && recordSnapshot) pushSnapshot();
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
