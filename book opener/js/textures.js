import * as THREE from 'three';

export function generateThumbnail(texture) {
    if (!texture || !texture.image) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = texture.image;
    const w = img.naturalWidth || img.width || 128;
    const h = img.naturalHeight || img.height || 96;
    canvas.width = Math.min(w, 160);
    canvas.height = Math.min(h, 120);
    try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
        return null;
    }
}

export function createPaperTexture() {
    const canvas = document.createElement('canvas');
    const w = 512, h = 512;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 12;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise - 3));
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const len = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI;
        ctx.strokeStyle = Math.random() > 0.5 ? '#c8c0b0' : '#a09888';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
