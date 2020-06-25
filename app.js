const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs');
const WebTorrent = require('webtorrent');
const client = new WebTorrent();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.set('view engine', 'pug');

const tempPath = path.join(__dirname, 'temp');
const targetPath = path.join(__dirname, '..', 'toMove');

const cleanTempFolder = () => {
    try { rimraf.sync(tempPath); } catch (e) { }
}

const deselectAllFiles = (torrent) => {
    if (torrent && torrent.files) {
        torrent.files.forEach(file => file.deselect());
        torrent.deselect(0, torrent.pieces.length - 1, false);
    }
}

const selectCheckedFiles = (files, body) => {
    files.forEach((file) => {
        if (body[file.name] === 'on') {
            console.log('Selecting file:', file.name);
            file.select();
        }
    });
}

const downloadSubtitle = (subtitleURL) => {
    const { http, https } = require('follow-redirects');
    const protocol = subtitleURL.startsWith('https') ? https : http;
    const zipFilePath = path.join(tempPath, 'temp.zip');
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(zipFilePath);

        const request = protocol.get(subtitleURL, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(zipFilePath);
            });
        });

        request.on('error', (err) => {
            fs.unlink(zipFilePath);
            reject(err.message);
        })
    })
}

const getBiggestFileName = (files) => {
    let biggestFile = files[0];
    files.forEach(file => {
        if (file.length > biggestFile.length) {
            biggestFile = file;
        }
    })
    return biggestFile.name;
}

const extractSubtitle = (zipFilePath, torrentFolder) => {
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

const renameSubtitle = (oldSubtitlePath, filename) => {
    const parsedSubtitlePath = path.parse(oldSubtitlePath);
    const newSubtitlePath = path.join(parsedSubtitlePath.dir, filename + parsedSubtitlePath.ext);
    fs.renameSync(oldSubtitlePath, newSubtitlePath);
}

const renameFolder = (root, oldFolderName, newFolderName) => {
    const oldFullPath = path.join(root, oldFolderName);
    const newFullPath = path.join(root, newFolderName);
    fs.renameSync(oldFullPath, newFullPath);
}

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/magnet', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    client.add(magnetURI, { path: tempPath }, (torrent) => {
        const files = [];
        torrent.files.forEach(file => {
            files.push(file.name);
        });
        client.remove(magnetURI);
        cleanTempFolder();
        res.render('files', { files, magnetURI, folder: torrent.name });
    });
});

app.post('/download', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    const folder = req.body['folder'];
    const subtitleURL = req.body['subtitleURL'];
    client.add(magnetURI, { path: targetPath }, (torrent) => {
        res.redirect('/');
        deselectAllFiles(torrent);
        selectCheckedFiles(torrent.files, req.body);
        console.log('Started download of torrent with hash:', torrent.infoHash);
        if (subtitleURL) {
            console.log('Started subtitle download.');
            const videoFileName = getBiggestFileName(torrent.files);
            downloadSubtitle(subtitleURL)
                .then((zipFilePath) => {
                    return extractSubtitle(zipFilePath, torrent.name);
                })
                .then((subtitleFullPath) => {
                    renameSubtitle(subtitleFullPath, videoFileName.slice(0, -4));
                })
        }
        torrent.on('done', () => {
            torrent.destroy(err => {
                if (err) console.error(err);
            });
            console.log('Torrent finished downloading to:');
            console.log(torrent.path, torrent.name);
            if (folder && folder !== torrent.name) {
                renameFolder(torrent.path, torrent.name, folder);
            }
        });

        torrent.on('error', (error) => {
            client.remove(magnetURI);
            console.error('Could not download.', error);
            cleanTempFolder();
        });
    });
});

app.use('/', (req, res) => {
    res.render('index');
});

app.listen(3000);
