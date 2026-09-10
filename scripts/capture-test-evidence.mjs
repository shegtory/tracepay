import { execFileSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const resultPath = path.resolve('.vitest-evidence.json')
const screenshotPath = path.resolve('docs/screenshots/orange-belt/tests-passing.png')

execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', `--outputFile=${resultPath}`], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

const report = JSON.parse(await readFile(resultPath, 'utf8'))
const files = report.testResults || []
const passedTests = files.reduce((total, file) => total + (file.assertionResults || []).filter((test) => test.status === 'passed').length, 0)
const failedTests = files.reduce((total, file) => total + (file.assertionResults || []).filter((test) => test.status === 'failed').length, 0)
const duration = files.reduce((total, file) => total + Math.max(0, (file.endTime || 0) - (file.startTime || 0)), 0)

const rows = files.map((file) => {
  const assertions = file.assertionResults || []
  const passed = assertions.filter((test) => test.status === 'passed').length
  const name = path.relative(process.cwd(), file.name).replaceAll('\\', '/')
  return `<div class="row"><span class="check">✓</span><code>${name}</code><strong>${passed} tests</strong></div>`
}).join('')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#07100d;color:#eef4ef;font-family:Inter,Arial,sans-serif}
  main{width:1120px;margin:60px auto;padding:48px;border:1px solid #21352d;background:linear-gradient(145deg,#102019,#09130f)}
  .eyebrow{color:#c8ff60;font:12px monospace;letter-spacing:.18em}.header{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #21352d;padding-bottom:30px}
  h1{font-size:44px;margin:12px 0 0}.summary{text-align:right}.summary strong{display:block;color:#c8ff60;font:700 46px monospace}.summary span{color:#81958c;font:12px monospace}
  .rows{display:grid;gap:10px;margin-top:30px}.row{display:grid;grid-template-columns:30px 1fr auto;align-items:center;padding:16px 18px;border:1px solid #21352d;background:#0a1611}
  .check{display:grid;place-items:center;width:22px;height:22px;border:1px solid #2f654d;border-radius:50%;color:#c8ff60}.row code{color:#b8c8c0;font-size:13px}.row strong{color:#71e6b5;font:12px monospace}
  footer{display:flex;justify-content:space-between;margin-top:28px;color:#81958c;font:12px monospace}.pass{color:#71e6b5}
</style></head><body><main><div class="header"><div><span class="eyebrow">TRACEPAY · AUTOMATED TEST EVIDENCE</span><h1>All test suites passed</h1></div><div class="summary"><strong>${passedTests}</strong><span>TESTS PASSED</span></div></div><div class="rows">${rows}</div><footer><span class="pass">✓ ${files.length} files passed · ${failedTests} failed</span><span>Vitest · ${Math.round(duration)}ms aggregate</span></footer></main></body></html>`

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: screenshotPath })
} finally {
  await browser.close()
  await rm(resultPath, { force: true })
}

console.log(`Captured ${passedTests} passing tests across ${files.length} files.`)
