const puppeteer = require("puppeteer-extra")
const fs = require("fs")
// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
puppeteer.use(StealthPlugin())
// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker")
const { timeout, executablePath } = require("puppeteer")
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

const puppetierSettings = {
  headles: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  timeout: 0
}

/**
 * Store data array to CSV
 * @param {Array} data
 */
/* function storeDataToCsv(data, fileName) {
  fs.writeFileSync(fileName, data)
  console.log("Writing is done")
} */

function storeDataToCsv(data, fileName) {
  let fileExists = fs.existsSync(fileName)
  if (fileExists) {
    let existingData = fs.readFileSync(fileName, "utf8")
    // Compare existing data with new data
    if (existingData !== data) {
      fs.appendFileSync(fileName, data)
      console.log("Data is identical, appending to file")
    } else {
      fs.writeFileSync(fileName, data)
      console.log("Data differs, overwriting file")
    }
  } else {
    // If file doesn't exist, create and write data
    fs.writeFileSync(fileName, data)
    console.log("File doesn't exist, creating and writing data")
  }
}

/**
 * Check is string formated like employes
 * @param {String} s
 * @returns
 */
function isInFormatForEmploy(s) {
  // Regular expression pattern for the format "10 - 49" (or similar)
  const pattern = /^\d+ - \d+$/
  return pattern.test(s)
}

/**
 * Convert Array Data to CSV
 * @param {Array} data
 * @returns
 */
function convertArrayToCsv(data) {
  const csvRows = []

  // Get the headers
  const headers = Object.keys(data[0])
  csvRows.push(headers.join(","))

  // Loop over the rows
  for (const row of data) {
    const values = headers.map((header) => {
      const escape = ("" + row[header]).replace(/"/g, '""')
      return `"${escape}"`
    })
    csvRows.push(values.join(","))
  }

  // Create a CSV string
  return csvRows.join("\n")
}

/**
 * Collect Agency Profile URL for continue with scraping
 * @param {String} url
 * @returns
 */
async function collectUrls(url) {
  const browser = await puppeteer.launch(puppetierSettings)
  const page = await browser.newPage()

  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080
  })

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0
  })

  const result = await page.$$eval(".provider__title a", (titles) => titles.map((titles) => titles.getAttribute("href")))

  await browser.close()
  return result
}

/**
 * Fetch needed data from agency with providing agency profile URL
 * @param {String} url
 * @returns
 */
async function fetchAgencyData(url) {
  const browser = await puppeteer.launch(puppetierSettings)
  const page = await browser.newPage()
  let dataObject = {}
  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080
  })

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0
  })

  // Fetch Website
  const websiteData = await page.$$eval(".website-link__item", (details) => details.map((detail) => detail.getAttribute("href")))
  dataObject.url = url
  dataObject.website = websiteData[0]

  // Fetch Address
  const siblingText = await page.evaluate(() => {
    // Get the first element with the class '.icon_pin'
    const iconPin = document.querySelector(".icon_pin")

    if (iconPin && iconPin.nextElementSibling) {
      // Get the innerText of the first sibling
      return iconPin.nextElementSibling.innerText
    }
    return null // or handle the case when the element or sibling is not found
  })
  dataObject.address = siblingText

  // GET Agency Services -------------------------------------------------------------------------------------------------------------
  const serviceDetails = await page.$$eval(".chart-legend--item", (details) => details.map((detail) => detail.innerText))
  let transformedServices = await serviceDetails.map((client) => {
    let [name, percentage] = client.split("\n")
    return `${percentage} ${name}`
  })
  dataObject.services = transformedServices.join(",")

  // GET Agency Basic Details ---------------------------------------------------------------------------------------------------------
  const basicDetails = await page.$$eval(".profile-summary__details li", (details) => details.map((detail) => detail.innerText))

  basicDetails.forEach((d) => {
    if (d.includes("$") && !d.includes("hr")) {
      dataObject.price = d
    }
    if (d.includes("ified")) {
      dataObject.verified = d
    }
    if (d.includes("hr")) {
      dataObject.hourly = d
    }
    if (isInFormatForEmploy(d) && !d.includes("$")) {
      dataObject.employees = d
    }
  })

  // GET Agency Name
  const name = await page.$$eval(".profile-header__title", (details) => details.map((detail) => detail.innerText))
  dataObject.name = name[0]
  // GET Agency Slogan
  const slogan = await page.$$eval(".profile-summary__tagline", (details) => details.map((detail) => detail.innerText))
  dataObject.slogan = slogan[0]
  // GET Agency Description
  const description = await page.$$eval(".profile-summary__text", (details) => details.map((detail) => detail.innerHTML))
  dataObject.description = description[0]
  // GET Agency Clients
  await page.waitForSelector('button[data-id="clients"]')
  await page.click('button[data-id="clients"]')
  await new Promise((resolve) => setTimeout(resolve, 3500))
  const clientsDetails = await page.$$eval(".chart-legend--item", (details) => details.map((detail) => detail.innerText))

  let transformedClients = await clientsDetails.map((client) => {
    let [name, percentage] = client.split("\n")
    return `${percentage} ${name}`
  })

  dataObject.clients = transformedClients.join(",")

  // GET Agency Industries
  await page.waitForSelector('button[data-id="industries"]')
  await page.click('button[data-id="industries"]')
  await new Promise((resolve) => setTimeout(resolve, 3500))
  const industriesDetails = await page.$$eval(".chart-legend--item", (details) => details.map((detail) => detail.innerText))

  let transformedIndustries = await industriesDetails.map((client) => {
    let [name, percentage] = client.split("\n")
    return `${percentage} ${name}`
  })

  dataObject.industries = transformedIndustries.join(",")

  // Get Agency Packages URL
  const packageUrlData = await page.$$eval("#packages-link", (details) => details.map((detail) => detail.getAttribute("href")))
  if (packageUrlData.length > 0) {
    dataObject.packages_url = "https://clutch.co/" + packageUrlData[0]
  } else {
    dataObject.packages_url = ""
  }

  // Get Agency Packages
  if (dataObject.packages_url) {
    await page.goto(dataObject.packages_url, {
      waitUntil: "networkidle2",
      timeout: 0
    })

    // Packages title
    const packagesTitle = await page.$$eval(".package-details--title", (details) => details.map((detail) => detail.innerText))
    if (packagesTitle && packagesTitle.length > 0) {
      dataObject.packages_title = packagesTitle[0]
    } else {
      dataObject.packages_title = ""
    }

    // Packages summary
    const packagesSummary = await page.$$eval(".package-details--description", (details) => details.map((detail) => detail.innerText))
    if (packagesSummary && packagesSummary.length > 0) {
      dataObject.packages_summary = packagesSummary[0]
    } else {
      dataObject.packages_summary = ""
    }

    const packageTitle = await page.$$eval(".package_item--title", (details) => details.map((detail) => detail.innerText))
    const packagePrice = await page.$$eval(".package_item--price", (details) => details.map((detail) => detail.innerText))
    const packageDescription = await page.$$eval(".package_item--description", (details) => details.map((detail) => detail.innerText))

    const packageFeatures = await page.$$eval(".table-cells .table-feature", (details) => details.map((detail) => detail.innerText))
    const packageFeatureStatus = await page.$$eval(".table-cells td", (details) => details.map((detail) => detail.innerText))

    let packages = []
    let i = 0
    packageTitle.forEach((title) => {
      let package = {}
      package.title = title
      package.price = packagePrice[i]
      package.description = packageDescription[i]
      package.features = []
      let fv = i
      packageFeatures.forEach((f, index) => {
        let feature = {}
        feature.name = f
        feature.value = packageFeatureStatus[fv]
        package.features.push(feature)
        fv = fv + packageTitle.length
      })
      packages.push(package)
      i++
    })

    dataObject.packages = JSON.stringify(packages)
  } else {
    dataObject.packages = ""
  }

  await browser.close()

  return dataObject
}

;(async () => {
  const start = performance.now()
  let cleanedUrls = []
  let agenciesListPages = ["https://clutch.co/us/seo-firms?verification=true", "https://clutch.co/us/seo-firms?page=1&verification=true", "https://clutch.co/us/seo-firms?page=2&verification=true", "https://clutch.co/us/seo-firms?page=3&verification=true", "https://clutch.co/us/seo-firms?page=4&verification=true", "https://clutch.co/us/seo-firms?page=5&verification=true", "https://clutch.co/us/seo-firms?page=6&verification=true"]
  let urlss = await Promise.all(agenciesListPages.map((url) => collectUrls(url)))
  let mergedArray = [].concat.apply([], urlss)
  mergedArray.forEach((url) => {
    if (url.charAt(0) === "/" && !mergedArray.includes("https://clutch.co" + url)) {
      cleanedUrls.push("https://clutch.co" + url)
    }
  })

  let shortArray = cleanedUrls.slice(0, 100)

  let agencyData = []
  for (let i = 0; i < shortArray.length; i++) {
    let dataObject = {}
    dataObject = await fetchAgencyData(shortArray[i])
    console.log("Agency " + (i + 1) + " is finished")
    agencyData.push(dataObject)
  }
  const end = performance.now()
  let csvData = convertArrayToCsv(agencyData)
  storeDataToCsv(csvData, "agencies.csv")

  const timeInSeconds = (end - start) / 1000
  console.log(`Scraping took ${timeInSeconds} seconds.`)
})()
