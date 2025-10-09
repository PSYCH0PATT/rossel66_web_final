// Usage:
//   node scripts/scrape-covers.js --start https://account.zvonkodigital.ru/catalog --cookies cookies.json
//
// cookies.json format: [{ name, value, domain, path, httpOnly, secure, sameSite } ...]
// This script:
//  - opens the catalog with provided cookies
//  - walks through all pages
//  - extracts release title, UPC and cover <img src>
//  - updates data/releases.json by matching on UPC

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function humanDelay(min = 200, max = 700) {
  const ms = Math.round(min + Math.random() * (max - min))
  await sleep(ms)
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

async function addCookies(context, cookiesPath) {
  if (!cookiesPath) return
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'))
  await context.addCookies(cookies)
}

async function run() {
  const args = process.argv.slice(2)
  const startUrlIdx = args.indexOf('--start')
  const cookiesIdx = args.indexOf('--cookies')
  const startUrl = startUrlIdx !== -1 ? args[startUrlIdx + 1] : 'https://account.zvonkodigital.ru/catalog'
  const cookiesPath = cookiesIdx !== -1 ? args[cookiesIdx + 1] : null

  const releasesPath = path.join(__dirname, '../data/releases.json')
  const releases = loadJson(releasesPath)
  const upcToIndex = new Map()
  releases.forEach((r, i) => { if (r.upc) upcToIndex.set(String(r.upc).trim(), i) })

  const browser = await chromium.launch({ headless: false, slowMo: 50 })
  const context = await browser.newContext()
  await addCookies(context, cookiesPath)
  const page = await context.newPage()

  // set sane headers
  await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36' })

  await page.goto(startUrl, { waitUntil: 'networkidle' })
  await humanDelay(2000, 4000)
  
  // Wait for React app to load
  try {
    await page.waitForSelector('[class*="css-"], [class*="chakra-"], img[src*="/cover/"], img[src*="media.zvonko"]', { timeout: 10000 })
    console.log('✅ React app loaded')
  } catch (e) {
    console.log('⚠️ Timeout waiting for React content, proceeding anyway...')
  }

  let pageNum = 1
  let totalUpdated = 0

  while (true) {
    // Wait for list to render; adapt selectors to site's structure
    // Each release card should contain cover <img>, title text, UPC text
    await page.waitForTimeout(500)

    console.log(`\n📄 Page ${pageNum}: ${page.url()}`)
    
    // Find the main container and then release items
    const container = await page.locator('div.chakra-stack.css-muke40, div[class*="css-muke40"]').first()
    const items = await container.locator('div.css-1xgpa60').elementHandles()
    console.log(`Found ${items.length} potential release items`)
    
    for (const item of items) {
      try {
        // Look for cover image (chakra-image class)
        const img = await item.$('img.chakra-image')
        const src = img ? (await img.getAttribute('src')) : null
        
        // Look for UPC in full text content
        let upc = null
        const fullText = (await item.textContent()) || ''
        const upcMatch = fullText.match(/UPC([0-9]{10,15})/)
        if (upcMatch) {
          upc = upcMatch[1]
        }

        // Debug: print full text content of first few items
        if (pageNum === 1 && items.indexOf(item) < 3) {
          const fullText = (await item.textContent()) || ''
          console.log(`  DEBUG Item ${items.indexOf(item)}: "${fullText.substring(0, 200)}..."`)
        }
        
        console.log(`  Item: UPC=${upc || 'none'}, Cover=${src || 'none'}`)
        
        if (upc && src && upcToIndex.has(upc)) {
          const idx = upcToIndex.get(upc)
          if (!releases[idx].coverUrl || releases[idx].coverUrl !== src) {
            releases[idx].coverUrl = src
            releases[idx].updatedAt = new Date().toISOString()
            totalUpdated++
            console.log(`✅ Updated cover for UPC ${upc}: ${src}`)
          }
        } else if (upc && src) {
          console.log(`  ⚠️ UPC ${upc} not found in releases database`)
        }
      } catch {}
      await humanDelay()
    }

    // Manual pagination - ask user to switch pages
    console.log(`\n🔄 СТРАНИЦА ${pageNum} ОБРАБОТАНА`)
    console.log('📄 Переключите на следующую страницу вручную и нажмите Enter для продолжения')
    console.log('📄 Или нажмите Ctrl+C для завершения')
    
    // Wait for user input
    await new Promise((resolve) => {
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.once('data', (key) => {
        // Check if Ctrl+C was pressed
        if (key[0] === 3) {
          console.log('\n📄 Завершение работы...')
          process.exit(0)
        }
        process.stdin.setRawMode(false)
        process.stdin.pause()
        resolve()
      })
    })
    
    // Save progress after each page
    if (totalUpdated > 0) {
      saveJson(releasesPath, releases)
      console.log(`💾 Сохранено ${totalUpdated} обновлений обложек`)
    }
    
    pageNum++
    console.log(`\n📄 Продолжаем обработку страницы ${pageNum}...`)
    await humanDelay(1000, 2000)
  }

  if (totalUpdated > 0) {
    saveJson(releasesPath, releases)
    console.log(`\n🎉 Saved ${totalUpdated} cover updates to releases.json`)
  } else {
    console.log('No covers updated')
  }

  await browser.close()
}

run().catch(err => { console.error(err); process.exit(1) })


