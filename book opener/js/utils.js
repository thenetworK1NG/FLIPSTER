import * as THREE from 'three';
import {
    panLimitEnabled, panLimitRadius, panOriginTarget,
    setPanLimitEnabled, setPanLimitRadius, setPanOriginTarget,
    camera, controls, playingDirectionByAction
} from './state.js';

export function loadPanSettings() {
    try {
        const enabled = localStorage.getItem('panLimitEnabled');
        const radius = localStorage.getItem('panLimitRadius');
        const originStr = localStorage.getItem('panOriginTarget');
        if (enabled !== null) setPanLimitEnabled(enabled === 'true');
        if (radius !== null) setPanLimitRadius(parseFloat(radius) || 0);
        if (originStr) {
            const arr = JSON.parse(originStr);
            if (Array.isArray(arr) && arr.length === 3) {
                setPanOriginTarget(new THREE.Vector3(arr[0], arr[1], arr[2]));
            }
        }
    } catch {}
}

export function savePanSettings() {
    try {
        localStorage.setItem('panLimitEnabled', String(panLimitEnabled));
        localStorage.setItem('panLimitRadius', String(panLimitRadius));
        if (panOriginTarget) {
            localStorage.setItem('panOriginTarget', JSON.stringify([panOriginTarget.x, panOriginTarget.y, panOriginTarget.z]));
        }
    } catch {}
}

export function isMobileDevice() {
    return (typeof window !== 'undefined') && (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
}

export function isAnyAnimationPlaying() {
    return playingDirectionByAction && playingDirectionByAction.size > 0;
}

export function formatCameraSnippet() {
    const cam = camera;
    const ctrl = controls;
    const p = cam && cam.position ? cam.position : { x: 0, y: 0, z: 0 };
    const t = ctrl && ctrl.target ? ctrl.target : { x: 0, y: 0, z: 0 };
    const fov = cam && typeof cam.fov === 'number' ? cam.fov : 45;
    const fmt = (n) => (Math.abs(n) < 1e-6 ? 0 : Number(n)).toFixed(3);
    return [
        `camera.position.set(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)});`,
        `controls.target.set(${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)});`,
        `camera.fov = ${fmt(fov)};`,
        `camera.updateProjectionMatrix();`
    ].join('\n');
}

export function fitCameraToObject(cam, ctrl, object3D, offset = 1.2) {
    const box = new THREE.Box3().setFromObject(object3D);
    if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        if (ctrl) ctrl.target.copy(center);
        const maxSize = Math.max(size.x, size.y, size.z);
        const fov = cam.fov * (Math.PI / 180);
        const aspect = cam.aspect;
        const vDist = (maxSize / 2) / Math.tan(fov / 2);
        const hFov = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const hDist = (maxSize / 2) / Math.tan(hFov / 2);
        const dist = Math.max(vDist, hDist) * offset;
        const fromCenterDir = cam.position.clone().sub(center);
        if (fromCenterDir.lengthSq() < 1e-6) {
            fromCenterDir.set(0, 0, 1);
        }
        fromCenterDir.normalize();
        cam.position.copy(center.clone().add(fromCenterDir.multiplyScalar(dist)));
        cam.updateProjectionMatrix();
        if (ctrl) ctrl.update();
    }
}

export function normalizeName(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/\s+/g, '').replace(/\.[0-9]+$/, '');
}

export function getAncestorNames(obj) {
    const names = [];
    let cur = obj;
    while (cur) {
        if (cur.name) names.push(cur.name);
        cur = cur.parent;
    }
    return names;
}

export function findNamedAncestor(obj) {
    let cur = obj;
    while (cur) {
        if (cur.name && typeof cur.name === 'string' && cur.name.length > 0) return cur;
        cur = cur.parent;
    }
    return null;
}
