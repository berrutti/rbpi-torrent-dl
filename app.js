const path = require('path');
const rimraf = require('rimraf');
const WebTorrent = require('webtorrent');
const client = new WebTorrent();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.set('view engine', 'pug');

let magnetURI = '';

const cleanTempFolder = () => {
    console.log('Cleaning temp folder')
    try {
        rimraf.sync('./temp/*');
        console.log('Done');
    } catch (e) {
        console.log('Could not clean the temp folder');
        console.error(e);
    }
}

app.use(bodyParser.urlencoded({ extended: false }));

const files = [];

app.post('/magnet', (req, res) => {
    magnetURI = req.body['magnetURI'];

    client.add(magnetURI, { path: './temp/' }, (torrent) => {
        torrent.files.forEach(file => {
            files.push(file.name);
        });
        client.remove(magnetURI);
        cleanTempFolder();
        res.redirect('files');
    });
});

app.get('/files', (req, res) => {
    res.render('files', { files });
});

app.post('/download', (req, res) => {
    files = req.body['files'];
    client.add(magnetURI, { path: './temp/' }, (torrent) => {
        console.log('Started download of:', torrent.infoHash);
        torrent.on('download', (data) => {
            res.send(data);
        })
        client.remove(magnetURI);
        cleanTempFolder();
    });
});

app.use('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(3000);
