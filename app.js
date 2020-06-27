require('dotenv').config();
const WebTorrent = require('webtorrent');
const client = new WebTorrent();
const express = require('express');
const app = express();
const {
    cleanTempFolder,
    downloadSubtitle,
    extractSubtitle,
    renameSubtitle,
    renameFolder
} = require('./util/files');
const {
    selectTorrentFiles,
    getBiggestFileName
} = require('./util/torrents');

app.set('view engine', 'pug');
app.use(require('body-parser').urlencoded({ extended: false }));
app.use('/bulma', express.static(__dirname + '/node_modules/bulma/css/'));

app.post('/magnet', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    client.add(magnetURI, undefined, (torrent) => {
        const torrentFiles = [];
        torrent.files.forEach(file => {
            torrentFiles.push(file.name);
        });
        client.remove(magnetURI);
        cleanTempFolder();
        res.render('files', { torrentFiles, magnetURI, folder: torrent.name });
    });
});

app.post('/download', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    const subtitleURL = req.body['subtitleURL'];
    let folder = req.body['folder'];
    client.add(magnetURI, { path: process.env.DOWNLOAD_LOCATION }, (torrent) => {
        if (!folder) {
            folder = torrent.name;
        }
        selectTorrentFiles(torrent, req.body);
        const videoFileName = getBiggestFileName(torrent.files);
        let savedProgress = '';
        torrent.on('download', () => {
            let fixedProgress = (100 * torrent.progress).toFixed(0) + "%";
            if (savedProgress !== fixedProgress) {
                savedProgress = fixedProgress;
                console.log('Progress:', savedProgress);
            }
        });

        torrent.on('done', () => {
            torrent.destroy(err => {
                if (err) {
                    console.error(err);
                } else {
                    console.log('Download complete:', torrent.name);
                    if (folder !== torrent.name) {
                        renameFolder(torrent.path, torrent.name, folder);
                    }
                    if (subtitleURL) {
                        downloadSubtitle(subtitleURL)
                            .then((zipFilePath) => {
                                return extractSubtitle(zipFilePath, folder);
                            })
                            .then((subtitleFullPath) => {
                                renameSubtitle(subtitleFullPath, videoFileName);
                            }).catch(error => {
                                console.error(error);
                            })
                    }

                }
            });
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