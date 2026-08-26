import * as THREE from 'three';
import {
    mixer, animationClips, pageOpenByClip, playingDirectionByAction,
    pageConfig,
    getFrontCoverOpen, getLatchOpen
} from './state.js';
import { normalizeName, getAncestorNames, isAnyAnimationPlaying } from './utils.js';

export function isPageClip(clip) {
    return clip.tracks.some(track => {
        const nodeName = track.name.split('.')[0];
        return typeof nodeName === 'string' && nodeName.toLowerCase().includes('page');
    });
}

export function isFrontCoverClip(clip) {
    return clip.tracks.some(track => {
        const nodeName = track.name.split('.')[0];
        return nodeName === 'front_cover';
    });
}

export function isLatchClip(clip) {
    return clip.tracks.some(track => {
        const nodeName = track.name.split('.')[0];
        return nodeName === 'latch';
    });
}

export function getPrimaryPageName(clip) {
    for (const track of clip.tracks) {
        const nodeName = track.name.split('.')[0];
        if (nodeName && nodeName.toLowerCase().includes('page')) return nodeName;
    }
    return null;
}

export function extractPageIndex(name) {
    if (!name) return Number.MAX_SAFE_INTEGER;
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function getAllPageClips() {
    if (!animationClips) return [];
    const pages = animationClips.filter(isPageClip).map(clip => {
        const name = getPrimaryPageName(clip) || clip.name || '';
        return { clip, name, index: extractPageIndex(name) };
    });
    pages.sort((a, b) => a.index - b.index);
    return pages.map(p => p.clip);
}

export function getOrderedPageClips() {
    if (!animationClips) return [];
    if (pageConfig && pageConfig.length > 0) {
        const clipVisible = new Map();
        pageConfig.forEach(p => {
            if (!clipVisible.has(p.clip)) clipVisible.set(p.clip, false);
            if (p.visible) clipVisible.set(p.clip, true);
        });
        const seen = new Set();
        const ordered = [];
        const sorted = [...pageConfig].sort((a, b) => a.order - b.order);
        sorted.forEach(p => {
            if (!seen.has(p.clip) && clipVisible.get(p.clip)) {
                seen.add(p.clip);
                ordered.push(p.clip);
            }
        });
        if (ordered.length > 0) return ordered;
    }
    const pages = animationClips.filter(isPageClip).map(clip => {
        const name = getPrimaryPageName(clip) || clip.name || '';
        return { clip, name, index: extractPageIndex(name) };
    });
    pages.sort((a, b) => a.index - b.index);
    return pages.map(p => p.clip);
}

export function getFrontClips() {
    return (animationClips || []).filter(isFrontCoverClip);
}

export function getLatchClips() {
    return (animationClips || []).filter(isLatchClip);
}

export function getSplineClips() {
    if (!animationClips) return [];
    return animationClips.filter(clip => {
        if (clip.name && typeof clip.name === 'string' && clip.name.toLowerCase().includes('spline')) return true;
        return clip.tracks.some(track => track.name.split('.')[0] === 'spline');
    });
}

export function findPageClipForNodeName(nodeName) {
    if (!animationClips || !nodeName) return null;
    for (const clip of animationClips) {
        if (!isPageClip(clip)) continue;
        for (const track of clip.tracks) {
            const n = track.name.split('.')[0];
            if (n === nodeName) return clip;
        }
    }
    return null;
}

export function findPageClipForObject(obj) {
    if (!animationClips || !obj) return null;
    const ancestorNames = getAncestorNames(obj).map(normalizeName);
    for (const clip of animationClips) {
        if (!isPageClip(clip)) continue;
        for (const track of clip.tracks) {
            const nodeName = track.name.split('.')[0];
            const tn = normalizeName(nodeName);
            if (ancestorNames.includes(tn)) return clip;
        }
    }
    for (const clip of animationClips) {
        if (!isPageClip(clip)) continue;
        const primary = getPrimaryPageName(clip) || clip.name || '';
        const pn = normalizeName(primary);
        if (pn && ancestorNames.includes(pn)) return clip;
    }
    return null;
}

export function getClipTargetNodeNames(clip) {
    const names = new Set();
    clip.tracks.forEach(track => {
        const nodeName = track.name.split('.')[0];
        if (nodeName) names.add(nodeName);
    });
    return names;
}

function setsIntersect(a, b) {
    for (const v of a) {
        if (b.has(v)) return true;
    }
    return false;
}

export function stopConflictingActions(targetNodeNames, excludeClips = []) {
    if (!mixer || !animationClips) return;
    animationClips.forEach(c => {
        if (excludeClips.includes(c)) return;
        const names = getClipTargetNodeNames(c);
        if (setsIntersect(targetNodeNames, names)) {
            const a = mixer.existingAction(c);
            if (a) a.stop();
        }
    });
}

export function openPagesThen(targetClip, done) {
    const ordered = getOrderedPageClips();
    const idx = ordered.indexOf(targetClip);
    if (idx === -1) {
        done && done();
        return;
    }
    const toOpen = [];
    for (let i = 0; i < idx; i++) {
        if (pageOpenByClip.get(ordered[i]) !== true) {
            toOpen.push(ordered[i]);
        }
    }
    if (toOpen.length === 0) {
        done && done();
        return;
    }
    const [first, ...rest] = toOpen;
    const targets = getClipTargetNodeNames(first);
    stopConflictingActions(targets, [first]);
    const action = mixer.clipAction(first);
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset();
    action.timeScale = 1;
    action.play();
    playingDirectionByAction.set(action, 1);
    const handler = (e) => {
        if (e.action === action) {
            mixer.removeEventListener('finished', handler);
            if (rest.length > 0) {
                openPagesThen(targetClip, done);
            } else {
                done && done();
            }
        }
    };
    mixer.addEventListener('finished', handler);
}

export function closePagesThen(done, pagesToCloseDesc) {
    if (!pagesToCloseDesc || pagesToCloseDesc.length === 0) {
        done();
        return;
    }
    const [first, ...rest] = pagesToCloseDesc;
    const action = mixer.clipAction(first);
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.time = first.duration;
    action.paused = false;
    action.timeScale = -1;
    action.play();
    playingDirectionByAction.set(action, -1);
    const handler = (e) => {
        if (e.action === action) {
            mixer.removeEventListener('finished', handler);
            closePagesThen(done, rest);
        }
    };
    mixer.addEventListener('finished', handler);
}

export function playClipDirection(clip, direction, enforcePageState = false) {
    if (!mixer) return;
    if (enforcePageState && isPageClip(clip)) {
        const isOpen = pageOpenByClip.get(clip) === true;
        if (!getFrontCoverOpen()) {
            console.warn('Cannot turn pages while the front cover is closed');
            return;
        }
        if (direction > 0) {
            const ordered = getOrderedPageClips();
            let idx = ordered.indexOf(clip);
            if (idx > -1) {
                const laterOpen = [];
                for (let i = ordered.length - 1; i > idx; i--) {
                    if (pageOpenByClip.get(ordered[i]) === true) laterOpen.push(ordered[i]);
                }
                if (laterOpen.length > 0) {
                    closePagesThen(() => {
                        let needPrevOpen = false;
                        for (let i = 0; i < idx; i++) {
                            if (pageOpenByClip.get(ordered[i]) !== true) { needPrevOpen = true; break; }
                        }
                        if (needPrevOpen) {
                            openPagesThen(clip, () => playClipDirection(clip, 1, true));
                        } else {
                            playClipDirection(clip, 1, true);
                        }
                    }, laterOpen);
                    return;
                }
            }
            const ordered2 = getOrderedPageClips();
            const idx2 = ordered2.indexOf(clip);
            if (idx2 > 0) {
                let needOpen = false;
                for (let i = 0; i < idx2; i++) {
                    if (pageOpenByClip.get(ordered2[i]) !== true) {
                        needOpen = true;
                        break;
                    }
                }
                if (needOpen) {
                    openPagesThen(clip, () => playClipDirection(clip, direction, true));
                    return;
                }
            }
        }
        if (direction < 0) {
            const ordered3 = getOrderedPageClips();
            const idx3 = ordered3.indexOf(clip);
            if (idx3 !== -1) {
                for (let i = idx3 + 1; i < ordered3.length; i++) {
                    if (pageOpenByClip.get(ordered3[i]) === true) {
                        console.warn('Close later pages first');
                        return;
                    }
                }
            }
        }
        if (direction > 0 && isOpen) return;
        if (direction < 0 && !isOpen) return;
    }
    const targets = getClipTargetNodeNames(clip);
    stopConflictingActions(targets, [clip]);
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    if (direction < 0) {
        action.time = clip.duration;
        action.paused = false;
        action.timeScale = -1;
        action.play();
        playingDirectionByAction.set(action, -1);
    } else {
        action.reset();
        action.timeScale = 1;
        action.play();
        playingDirectionByAction.set(action, 1);
    }
}

export function playFrontCoverDirection(direction, frontClips, latchClips) {
    if (!mixer || !frontClips || frontClips.length === 0) return;
    if (direction > 0) {
        if (!getLatchOpen() && latchClips && latchClips.length > 0) {
            const startedLatchActions = playLatchDirection(1, latchClips, true) || [];
            if (startedLatchActions.length === 0) return;
            const remaining = new Set(startedLatchActions);
            const handler = (e) => {
                const a = e.action;
                if (remaining.has(a)) {
                    remaining.delete(a);
                    if (remaining.size === 0) {
                        mixer.removeEventListener('finished', handler);
                        playFrontCoverDirection(1, frontClips, latchClips);
                    }
                }
            };
            mixer.addEventListener('finished', handler);
            return;
        }
    } else {
        const orderedPages = getOrderedPageClips();
        const openPagesDesc = orderedPages
            .filter(clip => pageOpenByClip.get(clip) === true)
            .sort((a, b) => extractPageIndex(getPrimaryPageName(b) || b.name) - extractPageIndex(getPrimaryPageName(a) || a.name));
        if (openPagesDesc.length > 0) {
            closePagesThen(() => playFrontCoverDirection(-1, frontClips, latchClips), openPagesDesc);
            return;
        }
    }
    if (direction > 0 && getFrontCoverOpen()) return;
    if (direction < 0 && !getFrontCoverOpen()) return;
    const combinedTargets = new Set();
    frontClips.forEach(c => getClipTargetNodeNames(c).forEach(n => combinedTargets.add(n)));
    stopConflictingActions(combinedTargets, frontClips);
    const startedFrontActions = [];
    frontClips.forEach(clip => {
        const action = mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (direction < 0) {
            action.time = clip.duration;
            action.paused = false;
            action.timeScale = -1;
            action.play();
            playingDirectionByAction.set(action, -1);
            startedFrontActions.push(action);
        } else {
            action.reset();
            action.timeScale = 1;
            action.play();
            playingDirectionByAction.set(action, 1);
        }
    });

    if (animationClips) {
        const splineClips = animationClips.filter(clip => {
            if (clip.name && clip.name.toLowerCase().includes('spline')) return true;
            return clip.tracks.some(track => track.name.split('.')[0] === 'spline');
        });
        if (splineClips.length === 0) {
            console.warn('No spline animation clips found to play with front cover.');
        } else {
            console.log('Playing spline animation(s) with front cover:', splineClips.map(c => c.name));
        }
        splineClips.forEach(clip => {
            const action = mixer.clipAction(clip);
            action.enabled = true;
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            if (direction < 0) {
                action.time = clip.duration;
                action.paused = false;
                action.timeScale = -1;
                action.play();
                playingDirectionByAction.set(action, -1);
            } else {
                action.reset();
                action.timeScale = 1;
                action.play();
                playingDirectionByAction.set(action, 1);
            }
        });
    }

    if (direction < 0 && latchClips && latchClips.length > 0 && startedFrontActions.length > 0) {
        const remainingFront = new Set(startedFrontActions);
        const onFrontClosed = (e) => {
            if (remainingFront.has(e.action)) {
                remainingFront.delete(e.action);
                if (remainingFront.size === 0) {
                    mixer.removeEventListener('finished', onFrontClosed);
                    playLatchDirection(-1, latchClips);
                }
            }
        };
        mixer.addEventListener('finished', onFrontClosed);
    }
}

export function playLatchDirection(direction, latchClips, returnActions = false) {
    if (!mixer || !latchClips || latchClips.length === 0) return returnActions ? [] : undefined;
    if (direction > 0 && getLatchOpen()) return returnActions ? [] : undefined;
    if (direction < 0) {
        if (!getLatchOpen()) return returnActions ? [] : undefined;
        if (getFrontCoverOpen()) {
            console.warn('Cannot close latch while front cover is open');
            return returnActions ? [] : undefined;
        }
    }
    const combinedTargets = new Set();
    latchClips.forEach(c => getClipTargetNodeNames(c).forEach(n => combinedTargets.add(n)));
    stopConflictingActions(combinedTargets, latchClips);
    const started = [];
    latchClips.forEach(clip => {
        const action = mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (direction < 0) {
            action.time = clip.duration;
            action.paused = false;
            action.timeScale = -1;
            action.play();
            playingDirectionByAction.set(action, -1);
            started.push(action);
        } else {
            action.reset();
            action.timeScale = 1;
            action.play();
            playingDirectionByAction.set(action, 1);
            started.push(action);
        }
    });
    return returnActions ? started : undefined;
}
