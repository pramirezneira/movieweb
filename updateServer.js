// Function that receives a zip file and updates the Amazon Server files.
const fs = require("fs");
const admzip = require("adm-zip");
const path = __dirname + "/temp/temp.zip"
/**
 * 
 * @param { File } zipFile 
 */
module.exports = function updateServer(zipFile) {
    if (!fs.existsSync(__dirname + "/temp")) fs.mkdirSync(__dirname + "/temp");
    const readStream = zipFile.stream();
    const writeStream = fs.createWriteStream(path);
    readStream.pipeTo(writeStream);
    writeStream.on("close", () => {
        writeStream.destroy();
        const zip = new admzip(path);
        zip.extractAllTo(__dirname, true);
        console.log("Server updated");
    });
    stream.getReader();
}