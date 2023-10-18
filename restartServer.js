// Function that restarts the Amazon Server
const { exec } = require("child_process");
async function restartServer() {
    return await new Promise((resolve, reject) => {
        exec("sudo systemctl restart movieweb", (error, stdout, stderr) => {
            if (error) reject(error);
            if (stdout) resolve(stdout);
            if (stderr) reject(stderr);
        });
    });
}
module.exports = { restartServer };