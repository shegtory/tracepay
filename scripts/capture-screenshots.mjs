import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const baseUrl = process.env.TRACEPAY_URL || 'http://127.0.0.1:5173/'
const outputDir = path.resolve('docs/screenshots/orange-belt')

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ executablePath: chromePath, headless: true })

try {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await mobile.screenshot({ path: path.join(outputDir, 'mobile-responsive.png'), fullPage: false })

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
  await desktop.screenshot({ path: path.join(outputDir, 'desktop-dashboard.png'), fullPage: false })

  const ci = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await ci.goto('https://github.com/shegtory/tracepay/actions/runs/34512883894', { waitUntil: 'networkidle', timeout: 90_000 })
  await ci.screenshot({
    path: path.join(outputDir, 'ci-pipeline-passing.png'),
    clip: { x: 0, y: 0, width: 1440, height: 700 },
  })
} finally {
  await browser.close()
}

console.log(`Captured TracePay evidence from ${baseUrl}`)
