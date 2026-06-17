const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #222; line-height: 1.45; }
  h1 { font-size: 22pt; border-bottom: 2px solid #333; padding-bottom: 6px; margin-top: 0; }
  h2 { font-size: 16pt; border-bottom: 1px solid #bbb; padding-bottom: 4px; margin-top: 22pt; }
  h3 { font-size: 13pt; margin-top: 16pt; }
  h4 { font-size: 11.5pt; }
  p, li { font-size: 11pt; }
  code { font-family: Consolas, "Courier New", monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 4px; padding: 10px; overflow-x: hidden; page-break-inside: avoid; }
  pre code { background: transparent; padding: 0; font-size: 8.5pt; line-height: 1.25; white-space: pre; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 18pt 0; }
  a { color: #0366d6; text-decoration: none; }
  blockquote { border-left: 3px solid #ddd; padding: 2px 12px; color: #555; margin: 8pt 0; }
`;

async function convert(mdPath, pdfPath, browser) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <script src="${MARKED_CDN}"></script>
    <style>${CSS}</style>
  </head><body><div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(md)});
  </script></body></html>`;

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #555; width: 100%; padding: 0 16mm; display: flex; justify-content: space-between;">
        <span>Made by Harsha Toshniwal &mdash; Zensar Technologies</span>
        <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    margin: { top: '18mm', bottom: '22mm', left: '16mm', right: '16mm' },
  });
  await page.close();
  console.log(`wrote ${pdfPath}`);
}

(async () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  const targets = [
    [path.join(root, 'OCR_ARCHITECTURE.md'),           path.join(root, 'OCR_ARCHITECTURE.pdf')],
    [path.join(root, 'SYSTEM_ARCHITECTURE.md'),        path.join(root, 'SYSTEM_ARCHITECTURE.pdf')],
    [path.join(root, 'SYSTEM_ARCHITECTURE_TARGET.md'), path.join(root, 'SYSTEM_ARCHITECTURE_TARGET.pdf')],
  ];
  const browser = await chromium.launch();
  try {
    for (const [src, dst] of targets) await convert(src, dst, browser);
  } finally {
    await browser.close();
  }
})();
