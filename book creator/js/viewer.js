import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    scene, camera, renderer, controls, currentModel, mixer,
    animButtonsContainer, cameraInfoEl, lastCamHudUpdate,
    panLimitEnabled, panLimitRadius, panOriginTarget,
    raycaster, _touchDownPos, _touchDownTime, _didDrag, _potentialDragTarget,
    dragState,
    setScene, setCamera, setRenderer, setControls, setAnimButtonsContainer,
    setCameraInfoEl, setLastCamHudUpdate, setRaycaster,
    set_touchDownPos, set_touchDownTime, set_didDrag, set_potentialDragTarget,
    setDragState, setPanOriginTarget
} from './state.js';
import { isMobileDevice, loadPanSettings, savePanSettings } from './utils.js';
import { loadGLB } from './loader.js';
import { handleMobileTap, handlePointerPick, detectTurnableAt, beginDrag, updateDrag, endDrag } from './interaction.js';

export function initViewer() {
    const container = document.getElementById('viewer');
    container.style.touchAction = 'none';
    const animContainer = document.getElementById('animButtons');
    setAnimButtonsContainer(animContainer);
    if (animButtonsContainer) animButtonsContainer.classList.remove('visible');

    const camInfo = document.getElementById('cameraInfo');
    setCameraInfoEl(camInfo);

    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0xf0f0f0);
    setScene(newScene);

    const newCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    if (isMobileDevice()) {
        newCamera.position.set(0.848, 2.395, 37.029);
        newCamera.fov = 45;
        newCamera.updateProjectionMatrix();
    } else {
        newCamera.position.set(-4.459, 0.474, 21.784);
    }
    setCamera(newCamera);

    const newRenderer = new THREE.WebGLRenderer({ antialias: true });
    newRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(newRenderer.domElement);
    setRenderer(newRenderer);

    const newRaycaster = new THREE.Raycaster();
    setRaycaster(newRaycaster);
    newRenderer.__raycaster = newRaycaster;

    const ambientLight = new THREE.AmbientLight(0xfff5eb, 0.8);
    newScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xfff8f0, 1.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = false;
    newScene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0xe8eeff, 0.4);
    fillLight.position.set(-3, 4, -5);
    newScene.add(fillLight);

    const newControls = new OrbitControls(newCamera, newRenderer.domElement);
    if (isMobileDevice()) {
        newControls.target.set(-1.148, 0.010, -4.349);
    } else {
        newControls.target.set(-4.459, -0.269, -0.411);
    }
    newControls.enableRotate = false;
    newControls.enablePan = true;
    newControls.enableZoom = true;
    newControls.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    newControls.zoomSpeed = isMobileDevice() ? 0.8 : 1.0;
    newControls.panSpeed = isMobileDevice() ? 0.8 : 1.0;
    if (isMobileDevice()) {
        const maxInPos = new THREE.Vector3(-1.587, 1.381, 4.671);
        const maxInTarget = new THREE.Vector3(-2.023, 0.861, -4.356);
        newControls.minDistance = maxInPos.distanceTo(maxInTarget);
        const maxOutPos = new THREE.Vector3(-6.756, 2.575, 34.772);
        const maxOutTarget = new THREE.Vector3(-8.627, 0.340, -4.007);
        newControls.maxDistance = maxOutPos.distanceTo(maxOutTarget) * 1.2;
    } else {
        const pcMaxInPos = new THREE.Vector3(0.733, 1.071, 7.208);
        const pcMaxInTarget = new THREE.Vector3(0.733, 0.702, -3.820);
        newControls.minDistance = pcMaxInPos.distanceTo(pcMaxInTarget);
        const pcMaxOutPos = new THREE.Vector3(-5.565, 0.657, 31.426);
        const pcMaxOutTarget = new THREE.Vector3(-5.565, -0.527, -3.955);
        newControls.maxDistance = pcMaxOutPos.distanceTo(pcMaxOutTarget);
        newControls.zoomSpeed = 1.0;
    }
    setControls(newControls);

    setupPointerEvents(newRenderer);

    animate();

    loadGLB('book.glb');

    loadPanSettings();
    const origin = panOriginTarget;
    if (!origin) {
        setPanOriginTarget(newControls.target.clone());
    }

    window.addEventListener('keydown', (ev) => {
        if (ev.code === 'Space' && animButtonsContainer) {
            ev.preventDefault();
            animButtonsContainer.classList.toggle('visible');
        }
    });
}

function setupPointerEvents(newRenderer) {
    if (isMobileDevice()) {
        const canvas = newRenderer.domElement;
        let activeTouchPointers = new Set();
        canvas.addEventListener('pointerdown', (ev) => {
            if (ev.pointerType !== 'touch') return;
            activeTouchPointers.add(ev.pointerId);
            if (activeTouchPointers.size === 1) {
                set_touchDownPos({ x: ev.clientX, y: ev.clientY });
                set_touchDownTime(performance.now());
                set_didDrag(false);
                set_potentialDragTarget(detectTurnableAt(ev.clientX, ev.clientY));
            }
        }, { passive: true });
        canvas.addEventListener('pointermove', (ev) => {
            if (ev.pointerType !== 'touch') return;
            if (activeTouchPointers.size !== 1) return;
            const pos = _touchDownPos;
            if (!pos) return;
            const moved = Math.hypot(ev.clientX - pos.x, ev.clientY - pos.y);
            if (dragState) {
                set_didDrag(true);
                updateDrag(ev.clientX, ev.clientY);
                return;
            }
            if (moved > 8 && _potentialDragTarget) {
                if (beginDrag(_potentialDragTarget, ev.clientX, ev.clientY)) {
                    set_didDrag(true);
                }
            }
        }, { passive: true });
        canvas.addEventListener('pointerup', (ev) => {
            if (ev.pointerType !== 'touch') return;
            activeTouchPointers.delete(ev.pointerId);
            if (activeTouchPointers.size === 0) {
                const tNow = performance.now();
                const pos = _touchDownPos;
                const moved = pos ? Math.hypot(ev.clientX - pos.x, ev.clientY - pos.y) : 1e9;
                const dt = tNow - _touchDownTime;
                if (dragState) {
                    endDrag();
                } else if (pos && !_didDrag && moved < 8 && dt < 350) {
                    handleMobileTap(ev);
                }
                set_touchDownPos(null);
                set_potentialDragTarget(null);
            }
        }, { passive: true });
    } else {
        const canvas = newRenderer.domElement;
        canvas.addEventListener('pointerdown', (ev) => {
            if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
            if (ev.button !== 0) return;
            set_touchDownPos({ x: ev.clientX, y: ev.clientY });
            set_touchDownTime(performance.now());
            set_didDrag(false);
            set_potentialDragTarget(detectTurnableAt(ev.clientX, ev.clientY));
        }, { passive: true });
        canvas.addEventListener('pointermove', (ev) => {
            if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
            const pos = _touchDownPos;
            if (!pos) return;
            const moved = Math.hypot(ev.clientX - pos.x, ev.clientY - pos.y);
            if (dragState) {
                set_didDrag(true);
                updateDrag(ev.clientX, ev.clientY);
                return;
            }
            if (moved > 6 && _potentialDragTarget) {
                if (beginDrag(_potentialDragTarget, ev.clientX, ev.clientY)) {
                    set_didDrag(true);
                }
            }
        }, { passive: true });
        canvas.addEventListener('pointerup', (ev) => {
            if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
            if (ev.button !== 0) return;
            const tNow = performance.now();
            const pos = _touchDownPos;
            const moved = pos ? Math.hypot(ev.clientX - pos.x, ev.clientY - pos.y) : 1e9;
            const dt = tNow - _touchDownTime;
            if (dragState) {
                endDrag();
            } else if (pos && !_didDrag && moved < 6 && dt < 300) {
                handlePointerPick(ev.clientX, ev.clientY);
            }
            set_touchDownPos(null);
            set_potentialDragTarget(null);
        }, { passive: true });
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(0.016);
    controls.update();
    if (panLimitEnabled && panLimitRadius > 0 && panOriginTarget) {
        const curT = controls.target;
        const delta = curT.clone().sub(panOriginTarget);
        const dist = delta.length();
        if (dist > panLimitRadius) {
            delta.setLength(panLimitRadius);
            const clampedTarget = panOriginTarget.clone().add(delta);
            const adjust = clampedTarget.clone().sub(curT);
            controls.target.copy(clampedTarget);
            camera.position.add(adjust);
        }
    }
    if (cameraInfoEl) {
        const now = performance.now();
        if (now - lastCamHudUpdate > 100) {
            setLastCamHudUpdate(now);
            const p = camera.position;
            const t = controls ? controls.target : new THREE.Vector3();
            const rot = camera.rotation;
            const fmt = (n) => (Math.abs(n) < 1e-4 ? 0 : n).toFixed(3);
            cameraInfoEl.innerHTML = `
                <div class="row"><span class="label">pos</span><span>[${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}]</span></div>
                <div class="row"><span class="label">target</span><span>[${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)}]</span></div>
                <div class="row"><span class="label">rot</span><span>[${fmt(rot.x)}, ${fmt(rot.y)}, ${fmt(rot.z)}]</span></div>
                <div class="row"><span class="label">fov</span><span>${fmt(camera.fov)}</span></div>
                <div class="row" style="margin-top:6px"><button id="copyCamBtn" style="cursor:pointer;padding:4px 8px;border-radius:4px;border:1px solid #999;background:#1e1e1e;color:#fff;">Copy coords</button></div>
                ${isMobileDevice() ? `<div class="row"><span class="copy-hint">tap to copy</span></div>` : ''}
            `;
        }
    }
    renderer.render(scene, camera);
}
