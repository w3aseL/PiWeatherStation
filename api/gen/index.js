const puppeteer = require('puppeteer');
const { Router, query } = require('express');
const stream = require('stream');

var port = 0

const initPort = _port => {
  port = _port
}

function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

const genImg = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    env: {
      TZ: 'America/Chicago'
    }
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto(`http://localhost:${port}/chart-pages/${url}`,
  {
    waitUntil: 'networkidle0'
  });

  const example = await page.$('#root');
  const bounding_box = await example.boundingBox();

  await delay(5000);
  const fileData = await page.screenshot({
    clip: {
      x: bounding_box.x,
      y: bounding_box.y,
      width: Math.min(bounding_box.width, page.viewport().width),
      height: Math.min(bounding_box.height, page.viewport().height),
    },
  });

  await browser.close();
  console.log("closed browser");

  return fileData;
}

/**
 * @param {{}} queryObj 
 * @returns 
 */
const convertQueriesToQueryString = queryObj =>
  Object.keys(queryObj).filter(key => queryObj[key] !== undefined && queryObj[key] !== null).map(key => `${key}=${encodeURIComponent(queryObj[key])}`).join('&');

const VALID_CHART_TYPES = [ 'rain', 'temp', 'wind', 'pressure' ]

const genRouter = Router()

genRouter.get('/', async (req, res) => {
  const { chartType, date, time_unit, time_amount, span_from, showRate } = req.query

  if (!chartType || !VALID_CHART_TYPES.includes(chartType.toLowerCase())) {
    res.status(400).send({ message: "Please provide a chart type to generate under the 'chartType' query parameter." })
    return
  }

  var queryString = convertQueriesToQueryString({ date, time_unit, time_amount, span_from, showRate });

  const generatedFile = await genImg(`${chartType.toLowerCase()}.html${queryString !== '' ? `?${queryString}` : ''}`);
  
  var readStream = new stream.PassThrough();
  readStream.end(generatedFile);

  res.setHeader('Content-Disposition', 'attachment; filename=generated_chart.png');
  res.setHeader('Content-Type', 'image/png');

  readStream.pipe(res);
})

module.exports = {
  genRouter,
  initPort
}