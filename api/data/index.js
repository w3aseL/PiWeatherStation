const { performDatabaseOperation } = require('../storage')
const moment = require('moment-timezone')

const { registerEvent, emitEvent } = require('../sockets/subscriptions')
const { registerRequest } = require('../sockets')
 
// Data points

const ACCESS_KEY = 'M5nCSgbkvE';

var rainArr = []

var dataStatus = {
  temp: {
    temp_c: null,
    temp_f: null,
    humidity: null,
    lastUpdated: null
  },
  windSpeed: {
    kmh: null,
    mph: null,
    kmh_gust: null,
    mph_gust: null,
    lastUpdated: null
  },
  windDir: {
    label: null,
    dir: null,
    lastUpdated: null
  },
  rain: {
    rain_in_hr: null,
    rain_cm_hr: null,
    rain_in: null,
    rain_cm: null,
    lastUpdated: null
  },
  pressure: {
    air: null,
    sea_level: null,
    lastUpdated: null
  }
}

// Event registers
registerEvent("update:rain")
registerEvent("update:wind")
registerEvent("update:temp")
registerEvent("update:direction")
registerEvent("update:pressure")

// WebSocket requests
registerRequest("current-data", (_, ws) => {
  ws.json({ type: "data", payload: { eventName: "current-data", data: dataStatus } });
})

// Helper functions

const verifyToken = (req, res, next) => {
  var token = req.headers['authorization'];

  if (!token || token !== ACCESS_KEY) {
    res.status(401).send()
    return
  }

  next()
}

function initLastHourRainData() {
  var date = new Date()
  date.setHours(date.getHours() - 1)
  date.setSeconds(0)

  performDatabaseOperation(conn => {
    conn.query(`SELECT * FROM Rain WHERE Timestamp > ${conn.escape(date)}`)
      .then(data => {
        for (var i = 0; i < data.length; i++) {
          rainArr.push({ rainIn: new Number(data[i].RainIn), rainCm: new Number(data[i].RainCm) })
        }

        var rainAvgIn = rainArr.reduce((pSum, { rainIn }) => pSum + rainIn, 0) / 60
        var rainAvgCm = rainArr.reduce((pSum, { rainCm }) => pSum + rainCm, 0) / 60

        dataStatus = {
          ...dataStatus,
          rain: {
            ...dataStatus.rain,
            rain_in_hr: rainAvgIn,
            rain_cm_hr: rainAvgCm,
            lastUpdated: dataStatus.rain.lastUpdated != null ? dataStatus.rain.lastUpdated : new Date()
          }
        }
      })
      .catch(err => console.log(err))
      .finally(() => conn.end())
  })
}

function initCurrentDayRainData() {
  const date = moment().tz("America/Chicago").startOf('day').utc().toDate()

  performDatabaseOperation(conn => {
    conn.query(`SELECT SUM(RainIn) AS RainTotalIn, SUM(RainCm) AS RainTotalCm FROM Rain WHERE Timestamp > ${conn.escape(date)}`)
    .then(data => {
      var { RainTotalIn, RainTotalCm } = data[0]

      dataStatus = {
        ...dataStatus,
        rain: {
          ...dataStatus.rain,
          rain_in: new Number(RainTotalIn),
          rain_cm: new Number(RainTotalCm),
          lastUpdated: dataStatus.rain.lastUpdated != null ? dataStatus.rain.lastUpdated : new Date()
        }
      }
    })
    .catch(err => console.log(err))
    .finally(() => conn.end())
  })
}

function getUpdatedRainAvg(rin, rcm) {
  rainArr.push({ rainIn: rin, rainCm: rcm })
  rainArr = rainArr.slice(1)

  var rainAvgIn = rainArr.reduce((pSum, { rainIn }) => pSum + rainIn, 0)
  var rainAvgCm = rainArr.reduce((pSum, { rainCm }) => pSum + rainCm, 0)

  return { rainAvgIn, rainAvgCm }
}

setTimeout(() => {
  initLastHourRainData()
  initCurrentDayRainData()
}, 2500)

function getCurrentStatus() {
  return dataStatus
}

const doNothing = () => { }

const updateTemp = (req, res, next) => {
  const { temp_c, temp_f, humidity } = req.body

  const curDate = new Date()

  dataStatus = {
    ...dataStatus,
    temp: {
      temp_c,
      temp_f,
      humidity,
      lastUpdated: curDate
    }
  }

  emitEvent("update:temp", dataStatus.temp)

  performDatabaseOperation(conn => {
    conn.query(`INSERT INTO Temperature (TempC, TempF, Humidity, Timestamp) VALUES (${conn.escape(temp_c)}, ${conn.escape(temp_f)}, ${conn.escape(humidity)}, ${conn.escape(curDate)})`)
      .then(() => doNothing())
      .catch(err => console.log(err))
      .finally(() => {
        res.status(204).send()
        conn.end()
      })
  })
}

const updateWind = (req, res, next) => {
  const { kmh, mph, kmh_gust, mph_gust } = req.body

  const curDate = new Date()

  dataStatus = {
    ...dataStatus,
    windSpeed: {
      kmh,
      mph,
      kmh_gust,
      mph_gust,
      lastUpdated: curDate
    }
  }

  emitEvent("update:wind", dataStatus.windSpeed)

  performDatabaseOperation(conn => {
    conn.query(`INSERT INTO WindSpeed (AvgKmh, AvgMph, GustKmh, GustMph, Timestamp) VALUES (${conn.escape(kmh)}, ${conn.escape(mph)}, ${conn.escape(kmh_gust)}, ${conn.escape(mph_gust)}, ${conn.escape(curDate)})`)
      .then(() => doNothing())
      .catch(err => console.log(err))
      .finally(() => {
        res.status(204).send()
        conn.end()
      })
  })
}

const updateRain = (req, res, next) => {
  const { rin, cm } = req.body

  var { rain_in, rain_cm } = dataStatus.rain

  const curDate = moment().tz("America/Chicago").toDate()

  if (curDate.getHours() == 0 && curDate.getMinutes() == 0) {
    rain_in = 0.0
    rain_cm = 0.0
  }

  const { rainAvgIn, rainAvgCm } = getUpdatedRainAvg(rin, cm)

  dataStatus = {
    ...dataStatus,
    rain: {
      rain_in_hr: rainAvgIn,
      rain_cm_hr: rainAvgCm,
      rain_in: rain_in + rin,
      rain_cm: rain_cm + cm,
      lastUpdated: curDate
    }
  }

  emitEvent("update:rain", dataStatus.rain)

  performDatabaseOperation(conn => {
    conn.query(`INSERT INTO Rain (RainIn, RainCm, Timestamp) VALUES (${conn.escape(rin)}, ${conn.escape(cm)}, ${conn.escape(curDate)})`)
      .then(() => doNothing())
      .catch(err => console.log(err))
      .finally(() => {
        res.status(204).send()
        conn.end()
      })
  })
}

const updateWindDir = (req, res, next) => {
  const { deg, dir } = req.body

  const curDate = new Date()

  dataStatus = {
    ...dataStatus,
    windDir: {
      label: dir,
      dir: deg,
      lastUpdated: curDate
    },
  }

  emitEvent("update:direction", dataStatus.windDir)

  performDatabaseOperation(conn => {
    conn.query(`INSERT INTO WindDirection (Direction, Timestamp) VALUES (${conn.escape(deg)}, ${conn.escape(curDate)})`)
      .then(() => doNothing())
      .catch(err => console.log(err))
      .finally(() => {
        res.status(204).send()
        conn.end()
      })
  })
}

const updatePressure = (req, res, next) => {
  const { temp_c, pressure, sea_level } = req.body

  const curDate = new Date()

  dataStatus = {
    ...dataStatus,
    pressure: {
      air: pressure,
      sea_level,
      lastUpdated: curDate
    }
  }

  emitEvent("update:pressure", dataStatus.pressure)

  performDatabaseOperation(conn => {
    conn.query(`INSERT INTO AirPressure (Pressure, Timestamp) VALUES (${conn.escape(pressure)}, ${conn.escape(curDate)})`)
      .then(() => doNothing())
      .catch(err => console.log(err))
      .finally(() => {
        res.status(204).send()
        conn.end()
      })
  })
}

module.exports = {
  verifyToken,
  getCurrentStatus,
  updateWind,
  updateRain,
  updateTemp,
  updateWindDir,
  updatePressure
}