require('dotenv').config();
const path = require('path');
const WebTorrent = require('webtorrent');
const client = new WebTorrent();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const files = require('./util/files');
const torrents = require('./util/torrents');
app.set('view engine', 'pug');

const tempPath = path.join(__dirname, 'temp');
const targetPath = process.env.DOWNLOAD_LOCATION;

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/magnet', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    client.add(magnetURI, { path: tempPath }, (torrent) => {
        const torrentFiles = [];
        torrent.files.forEach(file => {
            torrentFiles.push(file.name);
        });
        client.remove(magnetURI);
        files.cleanTempFolder();
        res.render('files', { torrentFiles, magnetURI, folder: torrent.name });
    });
});

app.post('/download', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    const folder = req.body['folder'];
    const subtitleURL = req.body['subtitleURL'];
    client.add(magnetURI, { path: targetPath }, (torrent) => {
        torrents.deselectAllTorrentFiles(torrent);
        torrents.selectCheckedTorrentFiles(torrent.files, req.body);
        console.log('Started download of torrent with hash:', torrent.infoHash);
        let savedProgress = '';
        torrent.on('download', () => {
            let fixedProgress = torrent.progress.toFixed(2);
            if (savedProgress !== fixedProgress) {
                savedProgress = fixedProgress;
                console.log('Progress:', savedProgress);
            }
        });
        torrent.on('done', () => {
            torrent.destroy(err => {
                if (err) console.error(err);
            });
            console.log('Torrent finished downloading to:');
            console.log(torrent.path, torrent.name);
            if (subtitleURL) {
                console.log('Started subtitle download.');
                const videoFileName = getBiggestFileName(torrent.files);
                files.downloadSubtitle(subtitleURL)
                    .then((zipFilePath) => {
                        return files.extractSubtitle(zipFilePath, torrent.name);
                    })
                    .then((subtitleFullPath) => {
                        files.renameSubtitle(subtitleFullPath, videoFileName);
                    })
            }
            if (folder && folder !== torrent.name) {
                files.renameFolder(torrent.path, torrent.name, folder);
            }
        });

        torrent.on('error', (error) => {
            client.remove(magnetURI);
            console.error('Could not download.', error);
            files.cleanTempFolder();
        });
    });
    res.redirect(req.baseUrl + '/');
});

app.use('/', (req, res) => {
    res.render('index');
});

app.listen(3000);
console.log('Started server at port 3000');