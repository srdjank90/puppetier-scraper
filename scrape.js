const puppeteer = require("puppeteer-extra");
const fs = require("fs");
// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const { timeout } = require("puppeteer");
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

/**
 * Store data array to CSV
 * @param {Array} data
 */
function storeDataToCsv(data, fileName) {
  fs.writeFileSync(fileName, data);
  console.log("Writing is done");
}

function convertArrayToCsv(data) {
  const csvRows = [];

  // Get the headers
  const headers = Object.keys(data[0]);
  csvRows.push(headers.join(","));

  // Loop over the rows
  for (const row of data) {
    const values = headers.map((header) => {
      const escape = ("" + row[header]).replace(/"/g, '""');
      return `"${escape}"`;
    });
    csvRows.push(values.join(","));
  }

  // Create a CSV string
  return csvRows.join("\n");
}

async function collectUrls(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  const result = await page.$$eval(".provider__title a", (titles) => titles.map((titles) => titles.getAttribute("href")));

  await browser.close();
  return result;
}

/**
 * Collect Agency Clients
 * @param {String} url
 * @returns
 */
async function collectAgencyClients(url) {
  const browser = await puppeteer.launch({ headless: true, timeout: 0 });
  const page = await browser.newPage();

  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  await page.waitForSelector('button[data-id="clients"]');
  await page.click('button[data-id="clients"]');
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const basicDetails = await page.$$eval(".chart-legend--item", (details) => details.map((detail) => detail.innerText));

  let transformedClients = await basicDetails.map((client) => {
    let [name, percentage] = client.split("\n");
    return `${percentage} ${name}`;
  });

  await browser.close();
  return transformedClients.join(",");
}

/**
 * Collect Agency Basic Details
 * @param {String} url
 * @returns
 */
async function collectAgencyBasicDetails(url) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set the viewport size
    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    // Navigate to a webpage
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 0,
    });
    const basicDetails = await page.$$eval(".profile-summary__details li", (details) => details.map((detail) => detail.innerText));
    return basicDetails;
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Page: " + url);
    return false;
  }
}

/**
 * Collect Agency Serices
 * @param {String} url
 * @returns
 */
async function collectAgencyServices(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  const basicDetails = await page.$$eval(".chart-legend--item", (details) => details.map((detail) => detail.innerText));

  let transformedServices = await basicDetails.map((client) => {
    let [name, percentage] = client.split("\n");
    return `${percentage} ${name}`;
  });

  await browser.close();
  return transformedServices.join(",");
}

/**
 * Collect Agency Url and Website
 * @param {String} url
 * @returns
 */
async function collectAgencyUrlWebsite(url) {
  let data = [];
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set the viewport size
    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    // Navigate to a webpage
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 0,
    });

    // Fetch Website
    const websiteData = await page.$$eval(".website-link__item", (details) => details.map((detail) => detail.getAttribute("href")));
    data["url"] = url;
    data["website"] = websiteData[0];

    return data;
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Page: " + url);
    return "";
  }
}

/**
 * COllect Agency Addres
 * @param {String} url
 * @returns
 */
async function collectAgencyAddress(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set the viewport size
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // Navigate to a webpage
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  // Fetch Website
  //const addressData = await page.$$eval(".detailed-address", (details) => details.map((detail) => detail.innerText));

  const siblingText = await page.evaluate(() => {
    // Get the first element with the class '.icon_pin'
    const iconPin = document.querySelector(".icon_pin");

    if (iconPin && iconPin.nextElementSibling) {
      // Get the innerText of the first sibling
      return iconPin.nextElementSibling.innerText;
    }
    return null; // or handle the case when the element or sibling is not found
  });

  //console.log("Sibling text:", siblingText);
  await browser.close();

  return siblingText;
}

function isInFormatForEmploy(s) {
  // Regular expression pattern for the format "10 - 49" (or similar)
  const pattern = /^\d+ - \d+$/;
  return pattern.test(s);
}

(async () => {
  let cleanedUrls = [];
  let agenciesListPages = [
    "https://clutch.co/us/seo-firms?verification=true",
    "https://clutch.co/us/seo-firms?page=1&verification=true",
    "https://clutch.co/us/seo-firms?page=2&verification=true",
    "https://clutch.co/us/seo-firms?page=3&verification=true",
    "https://clutch.co/us/seo-firms?page=4&verification=true",
    "https://clutch.co/us/seo-firms?page=5&verification=true",
    "https://clutch.co/us/seo-firms?page=6&verification=true",
  ];
  let urlss = await Promise.all(agenciesListPages.map((url) => collectUrls(url)));
  let mergedArray = [].concat.apply([], urlss);
  mergedArray.forEach((url) => {
    if (url.charAt(0) === "/" && !mergedArray.includes("https://clutch.co" + url)) {
      cleanedUrls.push("https://clutch.co" + url);
    }
  });

  let shortArray = cleanedUrls.slice(0, 10);

  let agencyData = [];
  for (let i = 0; i < shortArray.length; i++) {
    let dataObject = {};
    let agData = await collectAgencyUrlWebsite(shortArray[i]);
    dataObject.url = agData["url"];
    dataObject.website = agData["website"];
    dataObject.services = await collectAgencyServices(shortArray[i]);
    dataObject.clients = await collectAgencyClients(shortArray[i]);
    let basicData = await collectAgencyBasicDetails(shortArray[i]);
    let address = await collectAgencyAddress(shortArray[i]);
    dataObject.address = address;
    basicData.forEach((d) => {
      if (d.includes("$") && !d.includes("hr")) {
        dataObject.price = d;
      }
      if (d.includes("ified")) {
        dataObject.verified = d;
      }
      if (d.includes("hr")) {
        dataObject.hourly = d;
      }
      if (isInFormatForEmploy(d) && !d.includes("$")) {
        dataObject.employees = d;
      }
    });

    console.log("Zavrsio: " + i);
    agencyData.push(dataObject);
  }

  let csvData = convertArrayToCsv(agencyData);
  storeDataToCsv(csvData, "agencies.csv");

  //console.log(agencyData);
  console.log("done!");
})();
