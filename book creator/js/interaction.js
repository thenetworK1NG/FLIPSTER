import * as THREE from 'three';
import {
    mixer, animationClips, currentModel, camera, renderer,
    pageOpenByClip, frontCoverOpen, dragState, _didDrag,
    _potentialDragTarget, _touchDownPos, _touchDownTime, controls,
    playingDirectionByAction,
    setDragState, set_didDrag, set_potentialDragTarget,
    set_touchDownPos, set_touchDownTime,
    getFrontCoverOpen, getLatchOpen
} from './state.js';
import { isAnyAnimationPlaying, normalizeName, getAncestorNames } from './utils.js';
import {
    isPageClip, isFrontCoverClip, isLatchClip,
    getFrontClips, getLatchClips, getSplineClips,
    findPageClipForObject, getClipTargetNodeNames,
    stopConflictingActions, getOrderedPageClips,
    getPrimaryPageName, extractPageIndex, openPagesThen,
    closePagesThen, playLatchDirection, playFrontCoverDirection,
    playClipDirection
} from './animation.js';

export function handleMobileTap(ev) {
    handlePointerPick(ev.clientX, ev.clientY);
}

export function handlePointerPick(clientX, clientY) {
    if (!camera || !currentModel) return;
    const ray = renderer && renderer.__raycaster;
    if (!ray) return;
    if (isAnyAnimationPlaying()) return;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera({ x, y }, camera);
    const hits = ray.intersectObject(currentModel, true);
    if (!hits || hits.length === 0) return;
    const ancestorNames = getAncestorNames(hits[0].object).map(normalizeName);
    if (ancestorNames.includes(normalizeName('front_cover'))) {
        const dir = getFrontCoverOpen() ? -1 : 1;
        const frontClips = getFrontClips();
        const latchClips = getLatchClips();
        playFrontCoverDirection(dir, frontClips, latchClips);
        return;
    }
    if (ancestorNames.includes(normalizeName('latch'))) {
        const dir = getLatchOpen() ? -1 : 1;
        const latchClips = getLatchClips();
        playLatchDirection(dir, latchClips);
        return;
    }
    const pageClip = findPageClipForObject(hits[0].object);
    if (pageClip) {
        const isOpen = pageOpenByClip.get(pageClip) === true;
        const dir = isOpen ? -1 : 1;
        playClipDirection(pageClip, dir, true);
        return;
    }
}

export function detectTurnableAt(clientX, clientY) {
    if (!camera || !currentModel) return null;
    const ray = renderer && renderer.__raycaster;
    if (!ray) return null;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera({ x, y }, camera);
    const hits = ray.intersectObject(currentModel, true);
    if (!hits || hits.length === 0) return null;
    const ancestorNames = getAncestorNames(hits[0].object).map(normalizeName);
    if (ancestorNames.includes(normalizeName('front_cover'))) {
        return { type: 'front', frontClips: getFrontClips(), latchClips: getLatchClips() };
    }
    const pageClip = findPageClipForObject(hits[0].object);
    if (pageClip) return { type: 'page', pageClip };
    return null;
}

export function beginDrag(target, clientX, clientY) {
    if (!mixer || !target) return false;
    if (isAnyAnimationPlaying()) return false;
    if (target.type === 'page' && !getFrontCoverOpen()) return false;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const baseSensitivity = 1.2;
    if (target.type === 'page') {
        const clip = target.pageClip;
        const targets = getClipTargetNodeNames(clip);
        stopConflictingActions(targets, [clip]);
        const action = mixer.existingAction(clip) || mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (pageOpenByClip.get(clip) === true) {
            action.play();
            action.paused = true;
            action.time = clip.duration;
        } else {
            action.reset();
            action.play();
            action.paused = true;
            action.time = 0;
        }
        setDragState({
            type: 'page',
            pageClip: clip,
            action,
            startX: clientX,
            startY: clientY,
            startT: action.time / clip.duration,
            duration: clip.duration,
            sensitivity: baseSensitivity / width
        });
    } else if (target.type === 'front' && target.frontClips && target.frontClips.length > 0) {
        const splineClips = getSplineClips();
        const combinedClips = [...target.frontClips, ...splineClips];
        const combinedTargets = new Set();
        combinedClips.forEach(c => getClipTargetNodeNames(c).forEach(n => combinedTargets.add(n)));
        stopConflictingActions(combinedTargets, combinedClips);
        const actions = combinedClips.map(clip => {
            const a = mixer.existingAction(clip) || mixer.clipAction(clip);
            a.enabled = true;
            a.setLoop(THREE.LoopOnce, 1);
            a.clampWhenFinished = true;
            if (getFrontCoverOpen()) {
                a.play();
                a.paused = true;
                a.time = clip.duration;
            } else {
                a.reset();
                a.play();
                a.paused = true;
                a.time = 0;
            }
            return { clip, action: a };
        });
        setDragState({
            type: 'front',
            actions,
            latchClips: target.latchClips || [],
            startX: clientX,
            startY: clientY,
            startT: actions.length ? (actions[0].action.time / actions[0].clip.duration) : 0,
            duration: actions.length ? actions[0].clip.duration : 1,
            sensitivity: baseSensitivity / width
        });
    }
    if (dragState) {
        if (controls) controls.enabled = false;
        return true;
    }
    return false;
}

export function updateDrag(clientX, clientY) {
    if (!dragState) return;
    const dx = clientX - dragState.startX;
    let t = dragState.startT + (-dx) * dragState.sensitivity;
    t = Math.min(1, Math.max(0, t));
    if (dragState.type === 'page') {
        const { action, duration } = dragState;
        action.time = t * duration;
    } else if (dragState.type === 'front') {
        const { actions } = dragState;
        actions.forEach(({ clip, action }) => {
            action.time = t * clip.duration;
        });
    }
}

export function endDrag() {
    if (!dragState) return;
    const t = (dragState.type === 'page')
        ? (dragState.action.time / dragState.duration)
        : (dragState.actions && dragState.actions.length ? dragState.actions[0].action.time / dragState.actions[0].clip.duration : 0);
    const openDir = t >= 0.5 ? 1 : -1;
    if (dragState.type === 'page') {
        finishPageDrag(openDir);
    } else if (dragState.type === 'front') {
        finishFrontDrag(openDir);
    }
    if (controls) controls.enabled = true;
    setDragState(null);
}

export function finishPageDrag(direction) {
    const clip = dragState.pageClip;
    const action = dragState.action;
    const ordered = getOrderedPageClips();
    const idx = ordered.indexOf(clip);
    if (direction > 0) {
        const laterOpen = [];
        for (let i = ordered.length - 1; i > idx; i--) {
            if (pageOpenByClip.get(ordered[i]) === true) laterOpen.push(ordered[i]);
        }
        const proceedAfterLaterClosed = () => {
            let needPrevOpen = false;
            for (let i = 0; i < idx; i++) {
                if (pageOpenByClip.get(ordered[i]) !== true) { needPrevOpen = true; break; }
            }
            const resume = () => {
                action.paused = false;
                action.timeScale = 1;
                playingDirectionByAction.set(action, 1);
            };
            if (needPrevOpen) openPagesThen(clip, resume); else resume();
        };
        if (laterOpen.length > 0) {
            closePagesThen(proceedAfterLaterClosed, laterOpen);
        } else {
            proceedAfterLaterClosed();
        }
    } else {
        for (let i = idx + 1; i < ordered.length; i++) {
            if (pageOpenByClip.get(ordered[i]) === true) {
                action.paused = false;
                action.timeScale = 1;
                playingDirectionByAction.set(action, 1);
                return;
            }
        }
        action.paused = false;
        action.timeScale = -1;
        playingDirectionByAction.set(action, -1);
    }
}

export function finishFrontDrag(direction) {
    const actions = dragState.actions || [];
    const latchClips = dragState.latchClips || [];
    if (direction > 0) {
        if (!getLatchOpen() && latchClips.length > 0) {
            const startedLatch = playLatchDirection(1, latchClips, true) || [];
            if (startedLatch.length > 0) {
                const remaining = new Set(startedLatch);
                const onLatch = (e) => {
                    if (remaining.has(e.action)) {
                        remaining.delete(e.action);
                        if (remaining.size === 0) {
                            mixer.removeEventListener('finished', onLatch);
                            resumeFront(direction, actions);
                        }
                    }
                };
                mixer.addEventListener('finished', onLatch);
                return;
            }
        }
        resumeFront(direction, actions);
    } else {
        const orderedPages = getOrderedPageClips();
        const openPagesDesc = orderedPages
            .filter(c => pageOpenByClip.get(c) === true)
            .sort((a, b) => extractPageIndex(getPrimaryPageName(b) || b.name) - extractPageIndex(getPrimaryPageName(a) || a.name));
        if (openPagesDesc.length > 0) {
            closePagesThen(() => {
                resumeFront(direction, actions, () => {
                    if (latchClips.length > 0) playLatchDirection(-1, latchClips);
                });
            }, openPagesDesc);
            return;
        }
        resumeFront(direction, actions, () => {
            if (latchClips.length > 0) playLatchDirection(-1, latchClips);
        });
    }
}

function resumeFront(direction, actions, afterAll) {
    if (!mixer) return;
    const remaining = new Set();
    actions.forEach(({ action }) => {
        action.paused = false;
        action.timeScale = direction > 0 ? 1 : -1;
        playingDirectionByAction.set(action, direction > 0 ? 1 : -1);
        remaining.add(action);
    });
    if (remaining.size > 0) {
        const onFin = (e) => {
            if (remaining.has(e.action)) {
                remaining.delete(e.action);
                if (remaining.size === 0) {
                    mixer.removeEventListener('finished', onFin);
                    if (afterAll) afterAll();
                }
            }
        };
        mixer.addEventListener('finished', onFin);
    } else if (afterAll) {
        afterAll();
    }
}
