function selectTorrentFiles(torrent, body) {
    torrent.deselect(0, torrent.pieces.length - 1, false);
    torrent.files.forEach(file => {
        if (body[file.name] === 'on') {
            console.log('Selected', file.name);
            file.select();
        } else {
            console.log('Deselected', file.name);
            file.deselect();
        }
    });
}

function getBiggestFileName(files) {
    let biggestFile = files[0];
    files.forEach(file => {
        if (file.length > biggestFile.length) {
            biggestFile = file;
        }
    })
    return biggestFile.name.slice(0, -4);
}

module.exports = {
    selectTorrentFiles,
    getBiggestFileName
};