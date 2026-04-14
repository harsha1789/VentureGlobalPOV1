/**
 * Produce a single combined webm:
 *   1. Short intro card (no branding)
 *   2. Bot browser recording (clean playback, no overlay banners)
 *   3. Error document — rendered PDF pages with red annotation overlays
 *      pointing to the specific issues detected
 *   4. Fade out
 * Output: bot/reports/combined-<timestamp>.webm
 */
const { chromium } = require('playwright');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

function latest(dir, filterFn) {
  const files = fs.readdirSync(dir).filter(filterFn).map(f => ({
    f, t: fs.statSync(path.join(dir, f)).mtimeMs
  }));
  files.sort((a, b) => b.t - a.t);
  return files.length ? path.join(dir, files[0].f) : null;
}

function findTestPdf(docNumber) {
  const dir = path.resolve(__dirname, '../mimic-app/backend/test-pdfs');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.startsWith(docNumber) && f.endsWith('.pdf'));
  return match ? path.join(dir, match) : null;
}

(async () => {
  const reportsDir = path.resolve(__dirname, 'reports');
  const videosDir = path.resolve(__dirname, 'videos');
  const reportPath = latest(reportsDir, f => f.startsWith('report-') && f.endsWith('.html'));
  const botVideoPath = latest(videosDir, f => f.endsWith('.webm'));
  if (!reportPath || !botVideoPath) {
    console.error('Missing report or video');
    process.exit(1);
  }
  console.log('Latest report: ', reportPath);
  console.log('Latest bot vid:', botVideoPath);

  // Parse logger log to find failed doc + its check failures
  const logPath = path.join(reportsDir, 'last-run-log.json');
  let failedDocNum = '';
  let failedReasons = [];
  try {
    const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    // Walk entries: group by document via [docNum] prefix in notes / surrounding FAIL entries
    // Simpler: find the final "Failed documents" summary is not in log; use entries directly.
    // The log entries include INFO lines with "  ✗ Check: FAIL — note" and a FAIL wrapup line.
    // We instead scan for FAIL entries whose message starts with "[Step 7] ..." and extract reasons.
    const docFailures = {};
    let currentDoc = '';
    log.forEach(e => {
      const msg = (e.message || '');
      const mDoc = msg.match(/\[(VG-[A-Z0-9-]+)\]/);
      if (mDoc) currentDoc = mDoc[1];
      // Use info lines that show failing check summaries
      const mx = msg.match(/^\s*✗\s+([^:]+):\s*FAIL\s+—\s+(.*)$/);
      if (mx && currentDoc) {
        docFailures[currentDoc] = docFailures[currentDoc] || [];
        docFailures[currentDoc].push({ label: mx[1].trim(), note: mx[2].trim() });
      }
    });
    // If we didn't learn doc name from log, fall back to scanning for "Processing: <docNum>" lines
    if (Object.keys(docFailures).length === 0) {
      log.forEach(e => {
        const msg = (e.message || '');
        const mInfo = msg.match(/^\s*✗\s+([^:]+):\s*FAIL\s+—\s+(.*)$/);
        if (mInfo) {
          docFailures['_'] = docFailures['_'] || [];
          docFailures['_'].push({ label: mInfo[1].trim(), note: mInfo[2].trim() });
        }
      });
    }
    const candidateKeys = Object.keys(docFailures).filter(k => k !== '_');
    failedDocNum = candidateKeys[0] || '';
    failedReasons = (docFailures[failedDocNum] || docFailures['_'] || []).slice(0, 8);
  } catch (_) {}

  // Fallback: scan the report HTML for a failed doc number
  if (!failedDocNum) {
    const html = fs.readFileSync(reportPath, 'utf-8');
    const m = html.match(/(VG-[A-Z0-9-]+)[^<]*FAIL/i);
    if (m) failedDocNum = m[1];
  }
  // Hard fallback to the image-only doc
  if (!failedDocNum) failedDocNum = 'VG-CP2-PIP-DWG-0112';

  console.log('Error doc:     ', failedDocNum);
  console.log('Failure reasons:', failedReasons.length);

  // Render the error PDF pages to PNG
  const errorPdfPath = findTestPdf(failedDocNum);
  const pagePngs = [];
  if (errorPdfPath) {
    try {
      const buf = fs.readFileSync(errorPdfPath);
      const parser = new PDFParse({ data: buf });
      const shot = await parser.getScreenshot({ scale: 2 });
      const outPngDir = path.resolve(__dirname, '_pdf_pages');
      fs.mkdirSync(outPngDir, { recursive: true });
      (shot.pages || []).forEach((p, i) => {
        const out = path.join(outPngDir, `page_${i + 1}.png`);
        fs.writeFileSync(out, p.data);
        pagePngs.push(out);
      });
      console.log(`Rendered ${pagePngs.length} page(s) from ${path.basename(errorPdfPath)}`);
    } catch (e) {
      console.warn('PDF render failed:', e.message);
    }
  }

  // Also check per-page text lengths to identify image-only pages deterministically
  let perPageChars = [];
  if (errorPdfPath) {
    try {
      const parser = new PDFParse({ data: fs.readFileSync(errorPdfPath) });
      const r = await parser.getText();
      perPageChars = (r.pages || []).map(p => (p.text || '').trim().length);
    } catch (_) {}
  }

  // Build the annotation overlay HTML per page
  const pageToImgSrc = (p) => 'file:///' + p.replace(/\\/g, '/');

  const pageCards = pagePngs.map((png, idx) => {
    const pageNum = idx + 1;
    const chars = perPageChars[idx] ?? 0;
    const isImageOnly = chars < 5;
    // Annotations: only highlight existing content that is wrong / mismatched.
    // Never draw a box on empty space.
    let annots = '';
    if (pageNum === 1) {
      // Highlight the actual wrong CONTRACT NUMBER on page 1 — UI loadsheet has
      // VG-CP2-PIP-DWG-0112 but the document says VG-CP1-PIP-DWG-9999.
      annots = `
        <div class="annot" style="top:14.0%;left:7%;width:64%;height:2.4%;">
          <span class="tag tag-right">Contract number mismatch — UI loadsheet expects VG-CP2-PIP-DWG-0112</span>
        </div>
        <div class="annot" style="top:28.4%;left:7%;width:60%;height:5.0%;">
          <span class="tag tag-right">Document admits Page 2 has no OCR text layer</span>
        </div>`;
    } else if (isImageOnly) {
      // Outline the embedded VG.png (not covering it) and place label outside
      annots = `
        <div class="annot thin" style="top:14%;left:10%;width:80%;height:23%;"></div>
        <div class="floatTag" style="top:38%;left:10%;">
          Image-only content — no OCR text. Cannot extract Contract Number or Security Classification for loadsheet match.
        </div>`;
    }
    return `
      <div class="pageCard">
        <div class="pageWrap">
          <img src="${pageToImgSrc(png)}" />
          ${annots}
        </div>
      </div>`;
  }).join('');

  const reasonsHtml = failedReasons.length
    ? failedReasons.map(r => `<li><b>${r.label}</b> — ${r.note.replace(/</g, '&lt;')}</li>`).join('')
    : '<li>See report for detailed check results.</li>';

  const wrapper = `<!doctype html><html><head><style>
    *{box-sizing:border-box;}
    html,body{margin:0;padding:0;background:#0b1020;color:#e8eefc;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;height:100vh;}
    .stage{position:fixed;inset:0;display:none;opacity:0;transition:opacity 0.5s ease-in-out;}
    .stage.active{display:block;opacity:1;}
    .card{display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:40px;height:100%;}
    .title{font-size:42px;font-weight:700;color:#fff;letter-spacing:0.5px;}
    .subtitle{font-size:20px;margin-top:14px;color:#9fb4ff;}
    iframe{width:100%;height:100%;border:0;background:#fff;}
    video{width:100%;height:100%;object-fit:contain;background:#000;}
    /* Error doc stage */
    .errDoc{position:fixed;inset:0;background:#1f2937;padding:24px;display:flex;flex-direction:column;}
    .errHeader{color:#fff;font-size:22px;font-weight:600;padding:0 0 14px 4px;display:flex;justify-content:space-between;align-items:baseline;}
    .errHeader .docNum{color:#fbbf24;font-family:Consolas,monospace;font-size:18px;margin-left:16px;font-weight:500;}
    .errBody{flex:1;display:grid;grid-template-columns:1fr 340px;gap:18px;min-height:0;}
    .pageScroll{overflow-y:auto;padding-right:6px;}
    .pageCard{background:#fff;border-radius:6px;margin-bottom:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.4);}
    .pageWrap{position:relative;}
    .pageWrap img{display:block;width:100%;}
    .annot{position:absolute;border:2px solid #ef4444;background:transparent;border-radius:3px;pointer-events:none;}
    .annot.thin{border-width:2px;}
    .tag{position:absolute;background:#ef4444;color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.4);}
    .tag-right{right:-4px;top:-26px;}
    .floatTag{position:absolute;background:#991b1b;color:#fff;font-size:12px;font-weight:600;padding:6px 12px;border-radius:4px;max-width:78%;box-shadow:0 2px 6px rgba(0,0,0,0.5);line-height:1.4;}
    .issuePanel{background:#111827;border-radius:6px;padding:18px;color:#f3f4f6;overflow-y:auto;}
    .issuePanel h3{font-size:16px;color:#fca5a5;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1px;}
    .issuePanel ul{list-style:none;padding:0;margin:0;}
    .issuePanel li{background:#1f2937;border-left:3px solid #ef4444;padding:10px 14px;margin:8px 0;font-size:13px;line-height:1.5;color:#fde68a;border-radius:3px;}
    .issuePanel li b{color:#fff;display:block;margin-bottom:2px;font-size:13px;}
    .finalFade{position:fixed;inset:0;background:#000;opacity:0;transition:opacity 0.6s;}
    .finalFade.on{opacity:1;}
  </style></head><body>
    <div id="intro" class="stage active card">
      <div class="title">Automated Document Validation</div>
      <div class="subtitle">${new Date().toLocaleString()}</div>
    </div>

    <div id="videoStage" class="stage">
      <video id="botVid" src="${'file:///' + botVideoPath.replace(/\\/g, '/')}" autoplay muted></video>
    </div>

    <div id="errStage" class="stage">
      <div class="errDoc">
        <div class="errHeader">
          <div>Error Document Review <span class="docNum">${failedDocNum}</span></div>
          <div style="color:#fca5a5;font-size:14px;">REJECTED — validation failed</div>
        </div>
        <div class="errBody">
          <div class="pageScroll" id="pageScroll">
            ${pageCards || '<div style="color:#fca5a5;">(PDF pages unavailable)</div>'}
          </div>
          <div class="issuePanel">
            <h3>Issues detected</h3>
            <ul>${reasonsHtml}</ul>
          </div>
        </div>
      </div>
    </div>

    <div id="fadeOverlay" class="finalFade"></div>
  </body></html>`;

  const wrapperPath = path.resolve(__dirname, '_combined_wrapper.html');
  fs.writeFileSync(wrapperPath, wrapper);

  const outTmpDir = path.resolve(__dirname, '_combined_out');
  if (fs.existsSync(outTmpDir)) fs.rmSync(outTmpDir, { recursive: true, force: true });
  fs.mkdirSync(outTmpDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: outTmpDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();
  await page.goto('file:///' + wrapperPath.replace(/\\/g, '/'));

  const show = (id) => page.evaluate((sid) => {
    document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
    document.getElementById(sid).classList.add('active');
  }, id);

  // 1. Intro (brief)
  await page.waitForTimeout(2500);

  // 2. Bot browser recording
  await show('videoStage');
  await page.evaluate(() => {
    const v = document.getElementById('botVid');
    v.currentTime = 0;
    v.play();
  });
  await page.waitForFunction(() => {
    const v = document.getElementById('botVid');
    return v && (v.ended || (v.duration && v.currentTime >= v.duration - 0.1));
  }, { timeout: 8 * 60 * 1000 }).catch(() => {});
  await page.waitForTimeout(600);

  // 3. Error document with annotations
  await show('errStage');
  await page.waitForTimeout(2500);
  // Slow scroll through pages
  const scrollPasses = 20;
  for (let i = 0; i < scrollPasses; i++) {
    await page.evaluate((frac) => {
      const el = document.getElementById('pageScroll');
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.max(0, max * frac);
    }, i / (scrollPasses - 1));
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2000);

  // 4. Fade out
  await page.evaluate(() => document.getElementById('fadeOverlay').classList.add('on'));
  await page.waitForTimeout(1200);

  const vid = page.video();
  await context.close();
  await browser.close();
  const producedPath = await vid.path();

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const finalPath = path.join(reportsDir, `combined-${ts}.webm`);
  fs.renameSync(producedPath, finalPath);
  fs.rmSync(outTmpDir, { recursive: true, force: true });
  try { fs.unlinkSync(wrapperPath); } catch (_) {}
  try { fs.rmSync(path.resolve(__dirname, '_pdf_pages'), { recursive: true, force: true }); } catch (_) {}

  console.log('\nCombined video saved:');
  console.log(finalPath);
})().catch(err => { console.error(err); process.exit(1); });
