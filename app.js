const path = require('path');
const rimraf = require('rimraf');
const WebTorrent = require('webtorrent');
const client = new WebTorrent();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.set('view engine', 'pug');

const tempPath = path.join(__dirname, 'temp');
const targetPath = path.join(__dirname, '..', 'toMove');

const cleanTempFolder = () => {
    try {
        rimraf.sync(tempPath);
    } catch (e) {
        console.log('Could not clean the temp folder');
        console.error(e);
    }
}

const stopDownload = (torrent) => {
    torrent.files.forEach(file => file.deselect());
    torrent.deselect(0, torrent.pieces.length - 1, false);
}

const moveFiles = () => {
    console.log('Moved files inside', tempPath, 'to', targetPath);
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
        res.render('files', { files, magnetURI });
    });
});

app.post('/download', (req, res) => {
    const magnetURI = req.body['magnetURI'];
    client.add(magnetURI, { path: tempPath }, (torrent) => {
        console.log('Started download of torrent with hash:', torrent.infoHash);
        res.send('<h1>Downloading files</h1>');
        stopDownload(torrent);
        torrent.files.forEach((file) => {
            if (req.body[file.name] === 'on') {
                console.log('Selecting file:', file.name);
                file.select();
            }
        });

        torrent.on('done', function () {
            console.log('Torrent finished downloading.');
            moveFiles();
            cleanTempFolder();
        });
    });
});

app.use('/', (req, res) => {
    res.render('index');
});

app.listen(3000);
