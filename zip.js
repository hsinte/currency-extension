import fs from "fs";
import path from "path";

// archiver v8 ESM 正確用法
const archiverMod = await import("archiver");
const { ZipArchive } = archiverMod; // 使用 ZipArchive

const DIST_DIR = path.join(process.cwd(), "dist");
// 確保 dist 資料夾存在
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 輸出 zip 到 dist 資料夾內
const zipPath = path.join(DIST_DIR, "currency.zip");

const output = fs.createWriteStream(zipPath);

const archive = new ZipArchive({ zlib: { level: 9 } });

output.on("close", () => {
  console.log(
    `\n🎉 打包成功！已生成壓縮檔：currency.zip (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`,
  );
});

archive.on("error", (err) => {
  console.error("封裝錯誤:", err);
  process.exit(1);
});

archive.pipe(output);
archive.directory("dist/", false);
archive.finalize();
