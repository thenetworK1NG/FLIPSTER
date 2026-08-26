import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
    scene, camera, controls, currentModel, mixer, animationClips,
    pageOpenByClip, playingDirectionByAction, nextReverseByClip,
    frontCoverOpen, latchOpen, openBookReverseNext, animButtonsContainer,
    pageConfig,
    setCurrentModel, setMixer, setAnimationClips, setPageConfig,
    setFrontCoverOpen, setLatchOpen, setOpenBookReverseNext,
    getAnimationClips
} from './state.js';
import { isPageClip, isFrontCoverClip, isLatchClip, getOrderedPageClips, getPrimaryPageName, playFrontCoverDirection, playLatchDirection, playClipDirection } from './animation.js';
import { isAnyAnimationPlaying, isMobileDevice } from './utils.js';
import { initPageConfig } from './page-config.js';

export function loadGLB(urlOrBuffer) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse(child => {
            if (child.isMesh) child.geometry.dispose();
        });
        setCurrentModel(null);
    }
    setMixer(null);
    setAnimationClips(null);
    if (animButtonsContainer) animButtonsContainer.innerHTML = '';
    nextReverseByClip.clear();
    setOpenBookReverseNext(false);
    pageOpenByClip.clear();
    playingDirectionByAction.clear();
    setPageConfig([]);
    setFrontCoverOpen(false);
    setLatchOpen(false);

    const loader = new GLTFLoader();
    const onLoad = (gltf) => {
        setCurrentModel(gltf.scene);
        scene.add(currentModel);

        if (isMobileDevice()) {
            camera.position.set(0.848, 2.395, 37.029);
            controls.target.set(-1.148, 0.010, -4.349);
            camera.fov = 45;
            camera.updateProjectionMatrix();
            controls.update();
        }

        currentModel.traverse(obj => {
            if (obj.isMesh && obj.material) {
                obj.material.roughness = 0.95;
                obj.material.metalness = 0;
                obj.material.needsUpdate = true;
            }
            if (obj.name) {
                console.log('Object name:', obj.name);
            }
            if (obj.name === 'front_cover' || obj.name === 'latch') {
                console.log('Found:', obj.name, 'Type:', obj.type, obj);
            }
        });

        if (gltf.animations && gltf.animations.length > 0) {
            const newMixer = new THREE.AnimationMixer(currentModel);
            setMixer(newMixer);
            setAnimationClips(gltf.animations);

            newMixer.addEventListener('finished', (event) => {
                const action = event.action;
                if (!action) return;
                const clip = action.getClip ? action.getClip() : action._clip;
                const dir = playingDirectionByAction.get(action);
                playingDirectionByAction.delete(action);
                if (!clip || dir === undefined) return;
                if (isPageClip(clip)) {
                    pageOpenByClip.set(clip, dir > 0);
                }
                if (isFrontCoverClip(clip)) {
                    setFrontCoverOpen(dir > 0);
                }
                if (isLatchClip(clip)) {
                    setLatchOpen(dir > 0);
                }
            });

            console.group('GLTF Animation debug');
            animationClips.forEach((clip, cIdx) => {
                console.group(`Clip [${cIdx}]: ${clip.name || '(no name)'}`);
                clip.tracks.forEach(track => {
                    const trackPath = track.name;
                    const nodeName = trackPath.split('.')[0];
                    const targetNode = currentModel.getObjectByName(nodeName);
                    if (targetNode) {
                        console.log(`Track: %c${trackPath}`, 'color:green', '-> Found node:', nodeName, targetNode);
                    } else {
                        console.warn(`Track: %c${trackPath}`, 'color:orange', '-> No node named', nodeName, 'under gltf.scene');
                    }
                });
                console.groupEnd();
            });
            console.groupEnd();

            if (SHOW_ANIM_CONTROLS && animButtonsContainer) {
                buildAnimControlsUI();
            }

            initPageConfig();
        }

        try {
            const el = document.getElementById('loaderOverlay');
            if (el) {
                el.classList.add('hide');
                setTimeout(() => {
                    el.style.display = 'none';
                }, 1500);
            }
        } catch {}
    };

    const onError = (err) => {
        console.error('Failed to load GLB', err);
        try {
            const el = document.getElementById('loaderOverlay');
            if (el) {
                el.classList.add('hide');
                setTimeout(() => {
                    el.style.display = 'none';
                }, 1500);
            }
        } catch {}
    };

    if (typeof urlOrBuffer === 'string') {
        loader.load(urlOrBuffer, onLoad, undefined, onError);
    } else {
        try { loader.parse(urlOrBuffer, '', onLoad, onError); } catch (e) { onError(e); }
    }
}

export function loadGLBs(urls) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse(child => {
            if (child.isMesh) child.geometry.dispose();
        });
        setCurrentModel(null);
    }
    setMixer(null);
    setAnimationClips([]);
    if (animButtonsContainer) animButtonsContainer.innerHTML = '';
    nextReverseByClip.clear();
    setOpenBookReverseNext(false);
    pageOpenByClip.clear();
    playingDirectionByAction.clear();
    setFrontCoverOpen(false);
    setLatchOpen(false);

    const group = new THREE.Group();
    group.name = 'book_group';
    scene.add(group);
    setCurrentModel(group);

    const loader = new GLTFLoader();
    const loadOne = (url) => new Promise((resolve, reject) => {
        loader.load(url, (gltf) => resolve(gltf), undefined, reject);
    });

    Promise.all(urls.map(loadOne)).then((glts) => {
        const allClips = [];
        glts.forEach(gltf => {
            if (gltf && gltf.scene) currentModel.add(gltf.scene);
            if (gltf && gltf.animations && gltf.animations.length) {
                allClips.push(...gltf.animations);
            }
        });

        if (isMobileDevice()) {
            camera.position.set(0.848, 2.395, 37.029);
            controls.target.set(-1.148, 0.010, -4.349);
            camera.fov = 45;
            camera.updateProjectionMatrix();
            controls.update();
        }

        currentModel.traverse(obj => {
            if (obj.name) console.log('Object name:', obj.name);
            if (obj.name === 'front_cover' || obj.name === 'latch') {
                console.log('Found:', obj.name, 'Type:', obj.type, obj);
            }
        });

        if (allClips.length > 0) {
            const newMixer = new THREE.AnimationMixer(currentModel);
            setMixer(newMixer);
            setAnimationClips(allClips);

            newMixer.addEventListener('finished', (event) => {
                const action = event.action;
                if (!action) return;
                const clip = action.getClip ? action.getClip() : action._clip;
                const dir = playingDirectionByAction.get(action);
                playingDirectionByAction.delete(action);
                if (!clip || dir === undefined) return;
                if (isPageClip(clip)) pageOpenByClip.set(clip, dir > 0);
                if (isFrontCoverClip(clip)) setFrontCoverOpen(dir > 0);
                if (isLatchClip(clip)) setLatchOpen(dir > 0);
            });

            console.group('GLTF Animation debug (multi)');
            animationClips.forEach((clip, cIdx) => {
                console.group(`Clip [${cIdx}]: ${clip.name || '(no name)'}`);
                clip.tracks.forEach(track => {
                    const trackPath = track.name;
                    const nodeName = trackPath.split('.')[0];
                    const targetNode = currentModel.getObjectByName(nodeName);
                    if (targetNode) {
                        console.log(`Track: %c${trackPath}`, 'color:green', '-> Found node:', nodeName, targetNode);
                    } else {
                        console.warn(`Track: %c${trackPath}`, 'color:orange', '-> No node named', nodeName, 'under group');
                    }
                });
                console.groupEnd();
            });
            console.groupEnd();

            if (SHOW_ANIM_CONTROLS && animButtonsContainer) {
                buildAnimControlsUI();
            }

            initPageConfig();
        }
    }).catch((err) => {
        console.error('Failed to load split GLBs', err);
    });
}

const SHOW_ANIM_CONTROLS = true;

function buildAnimControlsUI() {
    if (!animButtonsContainer || !animationClips) return;
    animButtonsContainer.innerHTML = '';
    const animGroup = document.createElement('details');
    animGroup.style.maxWidth = '220px';
    const animSummary = document.createElement('summary');
    animSummary.textContent = 'Model animations';
    animSummary.style.cursor = 'pointer';
    animGroup.appendChild(animSummary);

    const camDetails = document.createElement('details');
    camDetails.style.margin = '10px 0';
    const camSummary = document.createElement('summary');
    camSummary.textContent = 'Camera Coordinates';
    camSummary.style.cursor = 'pointer';
    camDetails.appendChild(camSummary);

    const toggleCoordsBtn = document.createElement('button');
    toggleCoordsBtn.textContent = 'Toggle Camera Coords';
    toggleCoordsBtn.style.display = 'block';
    toggleCoordsBtn.style.marginBottom = '5px';
    camDetails.appendChild(toggleCoordsBtn);

    const coordsDisplay = document.createElement('div');
    coordsDisplay.style.font = '12px monospace';
    coordsDisplay.style.margin = '6px 0';
    coordsDisplay.style.display = 'none';
    camDetails.appendChild(coordsDisplay);

    const copyCoordsBtn = document.createElement('button');
    copyCoordsBtn.textContent = 'Copy Coords';
    copyCoordsBtn.style.display = 'block';
    copyCoordsBtn.style.marginBottom = '5px';
    copyCoordsBtn.style.marginTop = '5px';
    copyCoordsBtn.style.display = 'none';
    camDetails.appendChild(copyCoordsBtn);

    toggleCoordsBtn.onclick = () => {
        if (coordsDisplay.style.display === 'none') {
            if (camera) {
                coordsDisplay.textContent =
                    `Position: { x: ${camera.position.x.toFixed(3)}, y: ${camera.position.y.toFixed(3)}, z: ${camera.position.z.toFixed(3)} }\n` +
                    `Target:   { x: ${controls.target.x.toFixed(3)}, y: ${controls.target.y.toFixed(3)}, z: ${controls.target.z.toFixed(3)} }`;
            }
            coordsDisplay.style.display = 'block';
            copyCoordsBtn.style.display = 'block';
        } else {
            coordsDisplay.style.display = 'none';
            copyCoordsBtn.style.display = 'none';
        }
    };

    copyCoordsBtn.onclick = () => {
        if (camera && controls) {
            const coords =
                `Position: { x: ${camera.position.x.toFixed(3)}, y: ${camera.position.y.toFixed(3)}, z: ${camera.position.z.toFixed(3)} }\n` +
                `Target:   { x: ${controls.target.x.toFixed(3)}, y: ${controls.target.y.toFixed(3)}, z: ${controls.target.z.toFixed(3)} }`;
            navigator.clipboard.writeText(coords);
            copyCoordsBtn.textContent = 'Copied!';
            setTimeout(() => { copyCoordsBtn.textContent = 'Copy Coords'; }, 1200);
        }
    };

    animGroup.appendChild(camDetails);

    if (!isMobileDevice()) {
        const rotateWrap = document.createElement('label');
        rotateWrap.style.display = 'block';
        rotateWrap.style.margin = '6px 0 12px 0';
        rotateWrap.style.font = '12px sans-serif';
        const rotateToggle = document.createElement('input');
        rotateToggle.type = 'checkbox';
        rotateToggle.checked = controls ? !!controls.enableRotate : false;
        rotateWrap.appendChild(rotateToggle);
        rotateWrap.appendChild(document.createTextNode(' Enable rotation'));
        rotateToggle.addEventListener('change', () => {
            const enable = !!rotateToggle.checked;
            if (controls) {
                controls.enableRotate = enable;
                if (THREE.TOUCH) {
                    controls.touches.ONE = enable ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
                    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
                }
            }
        });
        animGroup.appendChild(rotateWrap);
    }

    const frontClips = animationClips.filter(isFrontCoverClip);
    const latchClips = animationClips.filter(isLatchClip);
    if (frontClips.length > 0) {
        const btnOpenFront = document.createElement('button');
        btnOpenFront.textContent = 'Open front_cover';
        btnOpenFront.style.display = 'block';
        btnOpenFront.style.marginBottom = '5px';
        btnOpenFront.onclick = () => { if (isAnyAnimationPlaying()) return; playFrontCoverDirection(1, frontClips, latchClips); };
        animGroup.appendChild(btnOpenFront);
        const btnCloseFront = document.createElement('button');
        btnCloseFront.textContent = 'Close front_cover';
        btnCloseFront.style.display = 'block';
        btnCloseFront.style.marginBottom = '12px';
        btnCloseFront.onclick = () => { if (isAnyAnimationPlaying()) return; playFrontCoverDirection(-1, frontClips, latchClips); };
        animGroup.appendChild(btnCloseFront);
    }
    if (latchClips.length > 0) {
        const btnOpenLatch = document.createElement('button');
        btnOpenLatch.textContent = 'Open latch';
        btnOpenLatch.style.display = 'block';
        btnOpenLatch.style.marginBottom = '5px';
        btnOpenLatch.onclick = () => { if (isAnyAnimationPlaying()) return; playLatchDirection(1, latchClips); };
        animGroup.appendChild(btnOpenLatch);
        const btnCloseLatch = document.createElement('button');
        btnCloseLatch.textContent = 'Close latch';
        btnCloseLatch.style.display = 'block';
        btnCloseLatch.style.marginBottom = '12px';
        btnCloseLatch.onclick = () => { if (isAnyAnimationPlaying()) return; playLatchDirection(-1, latchClips); };
        animGroup.appendChild(btnCloseLatch);
    }

    getOrderedPageClips().forEach((clip) => {
        const pageName = getPrimaryPageName(clip) || (clip.name || `page`);
        const btnOpen = document.createElement('button');
        btnOpen.textContent = `Open ${pageName}`;
        btnOpen.style.display = 'block';
        btnOpen.style.marginBottom = '5px';
        btnOpen.onclick = () => { if (isAnyAnimationPlaying()) return; playClipDirection(clip, 1, true); };
        animGroup.appendChild(btnOpen);
        const btnClose = document.createElement('button');
        btnClose.textContent = `Close ${pageName}`;
        btnClose.style.display = 'block';
        btnClose.style.marginBottom = '12px';
        btnClose.onclick = () => { if (isAnyAnimationPlaying()) return; playClipDirection(clip, -1, true); };
        animGroup.appendChild(btnClose);
        pageOpenByClip.set(clip, false);
        nextReverseByClip.set(clip, false);
    });

    animButtonsContainer.appendChild(animGroup);
    animButtonsContainer.classList.remove('visible');
}
