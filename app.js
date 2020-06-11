const path = require('path');

const WebTorrent = require('webtorrent')
const client = new WebTorrent();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const files = [];

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/magnet', (req, res, next) => {
    const magnetURI = req.body['magnetURI'];
    client.add(magnetURI, { path: './' }, function (torrent) {
        
        torrent.files.forEach(file => {
            files.push(file.name);
        });
        client.remove(magnetURI);
        client.destroy();
        res.json(files);
    });
});

app.use('/', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(3000);
