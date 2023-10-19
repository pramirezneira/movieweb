const fs = require("fs");
const admZip = require("adm-zip");
function update() {
    const zip = new admZip();
    fs.readdirSync(__dirname).forEach((value) => {
        if (value == ".env" || value == "serverstartup" || value == "node_modules") return;
        if (fs.statSync(`${__dirname}/${value}`).isDirectory()) zip.addLocalFolder(`${__dirname}/${value}`);
        else zip.addLocalFile(`${__dirname}/${value}`);
    });
    const formData = new FormData();
    formData.append("zipFile", new Blob([zip.toBuffer()], { type: "application/zip" }), "zip.zip");
    formData.append("a", zip.to)
    fetch("http://177.71.192.155/api/update", {
        method: "POST",
        body: formData
    }).then(response => response.text().then(result => console.log(result)));
}
update();
