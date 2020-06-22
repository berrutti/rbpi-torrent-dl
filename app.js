const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs-extra');
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

const moveAllFiles = (files, folder) => {
    const movingFiles = [];
    files.forEach(file => {
        const fullSourcePath = path.join(tempPath, file.path);
        const fullDestPath = path.join(targetPath, folder, file.name);
        console.log('Moving file', fullSourcePath, 'to', fullDestPath);
        movingFiles.push(fs.move(fullSourcePath, fullDestPath));
    });
    return Promise.all(movingFiles);
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

const extractSubtitle = (folder, filename, zipFilePath) => {
    const AdmZip = require('adm-zip');
    const fullDestPath = path.join(targetPath, folder, filename.slice(0,-3) + 'srt');
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    const subtitleEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.endsWith('srt'));
    zip.extractEntryTo(subtitleEntry.name, fullDestPath, false, true);
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
    client.add(magnetURI, { path: tempPath }, (torrent) => {
        const allFiles = torrent.files;
        const downloadedFiles = [];
        res.send('<h1>Downloading files</h1>');
        deselectAllFiles(torrent);
        allFiles.forEach((file) => {
            if (req.body[file.name] === 'on') {
                console.log('Selecting file:', file.name);
                file.select();
                downloadedFiles.push(file);
            }
        });
        console.log('Started download of torrent with hash:', torrent.infoHash);
        if (subtitleURL) {
            console.log('Started subtitle download.');
            const filename = getBiggestFileName(downloadedFiles);
            downloadSubtitle(subtitleURL).then((zipFilePath) => {
                extractSubtitle(folder, filename, zipFilePath);
            })
        }
        torrent.on('done', () => {
            torrent.destroy(err => {
                if (err) console.error(err);
            });
            console.log('Torrent finished downloading.');
            console.log('Started moving files to dest folder.');
            moveAllFiles(downloadedFiles, folder).then(() => {
                console.log('All files moved. Cleaning temp folder.')
                cleanTempFolder();
            });
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
