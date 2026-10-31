const THRESHOLD = 300
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let browser = null
let contexts = 0

const getBrowser = async () => {
  if (browser?.isConnected() && contexts < THRESHOLD) return browser
  if (browser) {
    try {
      await browser.close()
    } catch {}
    browser = null
  }
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    throw new Error('Playwright belum terpasang. Jalankan "npm install" lalu "npx playwright install chromium".')
  }
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox', '--disable-blink-features=AutomationControlled']
    })
  } catch {
    throw new Error('Chromium belum terpasang. Jalankan "npx playwright install chromium".')
  }
  contexts = 0
  return browser
}

export const fetchPageHtml = async (url, { selector, selectorTimeoutMs = 8000, gotoTimeoutMs = 40000 }) => {
  const instance = await getBrowser()
  contexts += 1
  const context = await instance.newContext({ userAgent: USER_AGENT })
  await context.route(/\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|css)$/, (route) => route.abort())
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: gotoTimeoutMs })
    try {
      await page.waitForSelector(selector, { timeout: selectorTimeoutMs })
    } catch {}
    return await page.content()
  } finally {
    await context.close()
  }
}

export const closeBrowser = async () => {
  if (!browser) return
  try {
    await browser.close()
  } catch {}
  browser = null
}
