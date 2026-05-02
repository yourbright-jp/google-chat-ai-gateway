const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

async function main() {
  const projectDir = __dirname;
  const rendersDir = path.join(projectDir, "renders");
  fs.mkdirSync(rendersDir, { recursive: true });

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: rendersDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const sourceUrl = pathToFileURL(path.join(projectDir, "index.html")).href;
  await page.goto(sourceUrl, { waitUntil: "load" });
  await page.waitForTimeout(17000);

  const video = page.video();
  await context.close();
  await browser.close();

  const videoPath = await video.path();
  const outputPath = path.join(rendersDir, "google-chat-ai-gateway-reply-demo.webm");
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.renameSync(videoPath, outputPath);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
