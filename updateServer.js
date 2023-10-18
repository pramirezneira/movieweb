// Function that receives a zip file and updates the Amazon Server files.
const fs = require("fs");
const admzip = require("adm-zip");
/**
 * 
 * @param { Express.Multer.File } zipFile 
 */
function updateServer(zipFile) {
    const zip = new admzip(zipFile.buffer);
    zip.getEntries().forEach((entry) => {
        if (entry.entryName == ".env" || entry.entryName == "serverstartup") return;
        zip.extractEntryTo(entry, __dirname, true, true);
    });
}
module.exports = { updateServer };
