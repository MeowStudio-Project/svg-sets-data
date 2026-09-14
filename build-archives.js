const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");
const json = "./json";
const output = "./archives";
const files = fs.readdirSync(json).filter(file => file.endsWith(".json"));
const total = files.length;
fs.mkdirSync(output, { recursive: true });
let completed = 0;
let progressVisible = false;
function renderProgress(processed, totalIcons) {
    const percent = totalIcons > 0 ? Math.floor((processed / totalIcons) * 100) : 100;
    if (progressVisible) process.stdout.write("\x1b[2A");
    process.stdout.write(`\x1b[2K\r———————————————————————————\n`);
    process.stdout.write(`\x1b[2K\rfiles: ${completed}/${total}\n`);
    process.stdout.write(`\x1b[2K\rfile processed: ${percent}%`);
    progressVisible = true;
}
function finishProgress(zipName) {
    if (!progressVisible) {
        process.stdout.write(`done: ${zipName}\n`);
        return;
    }
    process.stdout.write("\x1b[2A");
    process.stdout.write(`\x1b[2K\rdone: ${zipName}\n`);
    process.stdout.write("\x1b[2K\r");
    process.stdout.write("\x1b[2K\r");
    process.stdout.write("\x1b[2K\r");
    progressVisible = false;
}
async function buildArchive(file) {
    const data = JSON.parse(fs.readFileSync(path.join(json, file), "utf8"));
    if (!data.prefix || !data.icons) return null;
    const icons = Object.entries(data.icons).filter(([name, icon]) => icon && icon.hidden !== true && typeof icon.body === "string");
    const totalIcons = icons.length;
    const zipName = `${data.prefix}.zip`;
    const zipPath = path.join(output, zipName);
    const stream = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    return new Promise((resolve, reject) => {
        stream.on("close", () => resolve(zipName));
        stream.on("error", reject);
        archive.on("error", reject);
        archive.on("progress", progress => {
            if (progress.entries) renderProgress(progress.entries.processed, totalIcons);
        });
        archive.pipe(stream);
        renderProgress(0, totalIcons);
        for (const [name, icon] of icons) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${icon.body}</svg>`;
            archive.append(svg, { name: `${name}.svg` });
        }
        archive.finalize();
    });
}
async function main() {
    if (!fs.existsSync(json)) {
        console.error(`找不到 ${json}`);
        process.exit(1);
    }
    for (const file of files) {
        try {
            const zipName = await buildArchive(file);
            completed++;
            finishProgress(zipName);
            if (completed < total) {
                renderProgress(0, 0);
            }
        } catch (error) {
            if (progressVisible) {
                process.stdout.write("\x1b[2A");
                process.stdout.write("\x1b[2K\r");
                process.stdout.write("\x1b[2K\r");
                process.stdout.write("\x1b[2K\r");
                progressVisible = false;
            }
            console.error(`processing ${file} failed: ${error.message}`);
        }
    }
    if (progressVisible) {
        process.stdout.write("\x1b[2A");
        process.stdout.write("\x1b[2K\r");
        process.stdout.write("\x1b[2K\r");
        process.stdout.write("\x1b[2K\r");
        process.stdout.write("\r");
        progressVisible = false;
    }
    console.log("done!");
}
main().catch(error => {
    console.error(error);
    process.exit(1);
});