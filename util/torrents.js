function deselectAllTorrentFiles(torrent) {
    if (torrent && torrent.files) {
        torrent.files.forEach(file => file.deselect());
        torrent.deselect(0, torrent.pieces.length - 1, false);
    }
}

function selectCheckedTorrentFiles(files, body) {
    files.forEach((file) => {
        if (body[file.name] === 'on') {
            console.log('Selecting file:', file.name);
            file.select();
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
    deselectAllTorrentFiles,
    selectCheckedTorrentFiles,
    getBiggestFileName
};