import * as THREE from 'three';

// Three.js core
export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export let currentModel = null;

// Animation system
export let mixer = null;
export let animationClips = null;
export const nextReverseByClip = new Map();
export const pageOpenByClip = new Map();
export const playingDirectionByAction = new Map();

// Feature state
export let frontCoverOpen = false;
export let latchOpen = false;
export let openBookReverseNext = false;

// UI refs
export let animButtonsContainer = null;
export const SHOW_ANIM_CONTROLS = true;
export let ambientLightRef = null;
export let directionalLightRef = null;
export let cameraInfoEl = null;
export let lastCamHudUpdate = 0;

// Raycast + tap detection
export let raycaster = null;
export let _touchDownPos = null;
export let _touchDownTime = 0;

// Drag-to-turn state
export let dragState = null;
export let _didDrag = false;
export let _potentialDragTarget = null;

// Pan boundary settings
export let panLimitEnabled = true;
export let panLimitRadius = 10;
export let panOriginTarget = new THREE.Vector3(-9.121, 0.358, -3.984);

// Page configuration system
export let pageConfig = [];
export let pagePanelVisible = false;
export let _dragFromIndex = null;
export let _pageImageInputTarget = null;

// Setters for state mutation from other modules
export function setScene(v) { scene = v; }
export function setCamera(v) { camera = v; }
export function setRenderer(v) { renderer = v; }
export function setControls(v) { controls = v; }
export function setCurrentModel(v) { currentModel = v; }
export function setMixer(v) { mixer = v; }
export function setAnimationClips(v) { animationClips = v; }
export function setFrontCoverOpen(v) { frontCoverOpen = v; }
export function setLatchOpen(v) { latchOpen = v; }
export function setOpenBookReverseNext(v) { openBookReverseNext = v; }
export function setAnimButtonsContainer(v) { animButtonsContainer = v; }
export function setAmbientLightRef(v) { ambientLightRef = v; }
export function setDirectionalLightRef(v) { directionalLightRef = v; }
export function setCameraInfoEl(v) { cameraInfoEl = v; }
export function setLastCamHudUpdate(v) { lastCamHudUpdate = v; }
export function setRaycaster(v) { raycaster = v; }
export function set_touchDownPos(v) { _touchDownPos = v; }
export function set_touchDownTime(v) { _touchDownTime = v; }
export function setDragState(v) { dragState = v; }
export function set_didDrag(v) { _didDrag = v; }
export function set_potentialDragTarget(v) { _potentialDragTarget = v; }
export function setPanLimitEnabled(v) { panLimitEnabled = v; }
export function setPanLimitRadius(v) { panLimitRadius = v; }
export function setPanOriginTarget(v) { panOriginTarget = v; }
export function setPageConfig(v) { pageConfig = v; }
export function setPagePanelVisible(v) { pagePanelVisible = v; }
export function set_dragFromIndex(v) { _dragFromIndex = v; }
export function set_pageImageInputTarget(v) { _pageImageInputTarget = v; }

// Getters for cross-module access
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getControls() { return controls; }
export function getCurrentModel() { return currentModel; }
export function getMixer() { return mixer; }
export function getAnimationClips() { return animationClips; }
export function getFrontCoverOpen() { return frontCoverOpen; }
export function getLatchOpen() { return latchOpen; }
export function getOpenBookReverseNext() { return openBookReverseNext; }
export function getAnimButtonsContainer() { return animButtonsContainer; }
export function getCameraInfoEl() { return cameraInfoEl; }
export function getLastCamHudUpdate() { return lastCamHudUpdate; }
export function getRaycaster() { return raycaster; }
export function get_touchDownPos() { return _touchDownPos; }
export function get_touchDownTime() { return _touchDownTime; }
export function getDragState() { return dragState; }
export function get_didDrag() { return _didDrag; }
export function get_potentialDragTarget() { return _potentialDragTarget; }
export function getPanLimitEnabled() { return panLimitEnabled; }
export function getPanLimitRadius() { return panLimitRadius; }
export function getPanOriginTarget() { return panOriginTarget; }
export function getPageConfig() { return pageConfig; }
export function getPagePanelVisible() { return pagePanelVisible; }
export function get_dragFromIndex() { return _dragFromIndex; }
export function get_pageImageInputTarget() { return _pageImageInputTarget; }
