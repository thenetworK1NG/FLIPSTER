export async function importScrapbookZip(file) {
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error('JSZip not loaded');
    const zip = await JSZip.loadAsync(file);
    const metaFile = zip.file('metadata.json');
    if (!metaFile) throw new Error('No metadata.json found in ZIP');
    const metadata = JSON.parse(await metaFile.async('text'));
    const pagesMap = {};
    const pageFiles = zip.folder('pages');
    if (pageFiles) {
        const entries = [];
        pageFiles.forEach((path, entry) => { entries.push(entry); });
        await Promise.all(entries.map(async (entry) => {
            const blob = await entry.async('blob');
            pagesMap[entry.name] = blob;
        }));
    }
    let modelBlob = null;
    const glbFile = zip.file('book.glb');
    if (glbFile) {
        modelBlob = await glbFile.async('blob');
    }
    return { metadata, pagesMap, modelBlob };
}
