// Function that receives a zip file and updates the Amazon Server files.
const fs = require("fs");
const admzip = require("adm-zip");
/**
 * 
 * @param { Express.Multer.File } zipFile 
 */
function updateServer(zipFile) {
    const zip = new admzip(zipFile.buffer);
    zip.extractAllTo(__dirname, true);
}
module.exports = { updateServer };
