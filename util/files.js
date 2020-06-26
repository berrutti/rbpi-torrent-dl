const fs = require('fs');

function cleanTempFolder() {
    const rimraf = require('rimraf');
    try { rimraf.sync(tempPath); } catch (e) { }
}

function downloadSubtitle(subtitleURL) {
    const { http, https } = require('follow-redirects');
    const protocol = subtitleURL.startsWith('https') ? https : http;
    if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath);
    }
    const zipFilePath = path.join(tempPath, 'temp.zip');
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(zipFilePath);

        file.on('finish', () => {
            file.close();
            resolve(zipFilePath);
        });

        const request = protocol.get(subtitleURL, (response) => {
            response.pipe(file);
        });

        request.on('error', (err) => {
            fs.unlink(zipFilePath);
            reject(err.message);
        })
    })
}

function extractSubtitle(zipFilePath, torrentFolder) {
    const AdmZip = require('adm-zip');
    const fullDestPath = path.join(targetPath, torrentFolder);
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();
            const subtitleEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.endsWith('srt'));
            zip.extractEntryTo(subtitleEntry, fullDestPath, false, true);
            resolve(path.join(fullDestPath, subtitleEntry.name));
        } catch (e) {
            reject(e);
        }

    });
}

function renameSubtitle(oldSubtitlePath, filename) {
    try {
        const parsedSubtitlePath = path.parse(oldSubtitlePath);
        const newSubtitlePath = path.join(parsedSubtitlePath.dir, filename + parsedSubtitlePath.ext);
        fs.renameSync(oldSubtitlePath, newSubtitlePath);
    } catch (e) {
        console.error('Could not rename the subtitle:', e);
    }
}

function renameFolder(root, oldFolderName, newFolderName) {
    try {
        const oldFullPath = path.join(root, oldFolderName);
        const newFullPath = path.join(root, newFolderName);
        fs.renameSync(oldFullPath, newFullPath);
    } catch (e) {
        console.error('Could not rename the folder:', e);
    }
}

module.exports = {
    cleanTempFolder,
    downloadSubtitle,
    extractSubtitle,
    renameSubtitle,
    renameFolder
};