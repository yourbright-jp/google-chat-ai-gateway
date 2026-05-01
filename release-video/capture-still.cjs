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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(path.join(projectDir, "index.html")).href, { waitUntil: "load" });
  await page.waitForTimeout(7000);
  const outputPath = path.join(rendersDir, "google-chat-ai-gateway-reply-demo-preview.png");
  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
