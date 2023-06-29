const { performDatabaseOperation } = require('../storage')
const { Router } = require('express')
const moment = require('moment-timezone')

// Helpers

const TimeUnits = {
  Minute: 1,
  Hour: 2,
  Day: 3
}

/**
 * @param {string | undefined} timeUnit 
 * @returns {TimeUnits}
 */
const determineTimeUnit = timeUnit => {
  if (!timeUnit) return TimeUnits.Hour;

  switch (timeUnit) {
    case timeUnit.toLowerCase().charAt(0) == 'h':
      return TimeUnits.Hour;
    case timeUnit.toLowerCase().charAt(0) == 'm':
      return TimeUnits.Minute;
    case timeUnit.toLowerCase().charAt(0) == 'd':
      return TimeUnits.Day;
  }

  return TimeUnits.Hour;
}

/**
 * @param {TimeUnits} timeUnit 
 * @returns {moment.unitOfTime.DurationConstructor}
 */
const convertTimeUnitToMomentUnit = timeUnit => {
  switch(timeUnit) {
    case TimeUnits.Minute:
      return 'minutes';
    case TimeUnits.Hour:
      return 'hours';
    case TimeUnits.Day:
      return 'days';
  }
}

/**
 * @param {moment.Moment} date
 * @param {bool} isAdding
 * @param {TimeUnits} unit 
 * @param {Number} amount
 * @returns {moment.Moment}
 */
const calcDateAdjustmentByTimeSpan = (date, isAdding, unit, amount=24) => isAdding ? date.add(amount, convertTimeUnitToMomentUnit(unit)) : date.subtract(amount, convertTimeUnitToMomentUnit(unit));

const getDatesFromDateQuery = ({ date, time_unit, time_amount, span_from, is_rain }) => {
  var today = moment();

  var spanningFromNow = span_from && span_from.toLowerCase() == "now";
  var isRain = is_rain && is_rain === true;

  // console.log({ date, moment: moment(date) })

  if (date && !spanningFromNow){
    today = moment(date);

    if (today.hours() === 0 && today.minutes() === 0 && today.seconds()=== 0)
      today.add(1, 'day');
  }

  if (time_unit && time_amount) {
    var timeUnit = determineTimeUnit(time_unit);
    var timeAmount = Number(time_amount);

    const start = spanningFromNow ? calcDateAdjustmentByTimeSpan(today.clone(), false, timeUnit, timeAmount) : today.tz("America/Chicago");
    const end = spanningFromNow ? today.tz("America/Chicago") : calcDateAdjustmentByTimeSpan(today.clone(), true, timeUnit, timeAmount);

    return {
      start: !isRain ? start : start.subtract(1, 'hours'),
      end: end
    }
  }

  const start = today.tz("America/Chicago").startOf('day')
  const end = today.clone().tz("America/Chicago").endOf('day')

  return {
    start: !isRain ? start : start.subtract(1, 'hours'),
    end
  }
}

const fetchQueryFromDatabase = (table, columns, req, res, dataManipulator=data => data) => {
  const { start, end } = getDatesFromDateQuery(req.query)

  // console.log({ start: start.utc().toDate(), end: end.utc().toDate(), now: moment().utc().toDate() })

  performDatabaseOperation(conn => {
    conn.query(`SELECT ${columns.join(', ')}, Timestamp FROM ${table} WHERE Timestamp > ${conn.escape(start.utc().toDate())} AND Timestamp <= ${conn.escape(end.utc().toDate())}`)
    .then(data => {
      res.status(200).send({ data: dataManipulator(data.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)), start.clone().add(1, 'hours')) })
    })
    .catch(err => {
      console.log(err)
      res.status(500).send({ message: "Failed to fetch data!", error: err })
    })
    .finally(() => conn.end())
  })
}

// Functions

const rainStats = (req, res, next) => {
  req.query.is_rain = true;     // add rain for rate of rainfall purposes

  fetchQueryFromDatabase('Rain', [ 'RainIn', 'RainCm' ], req, res, (data, actualStart) => {
    var start = actualStart.utc().toDate();

    var fullData = data.map(d => ({
      rainIn: Number(d.RainIn),
      rainCm: Number(d.RainCm),
      timestamp: new Date(d.Timestamp)
    })).sort((a, b) => a.timestamp - b.timestamp);

    const MINUTE_RATE_INTERVAL = 5;

    var returnData = []

    var sumIn = 0, sumCm = 0, pointCount = 0;
    for(var i = 0; i < fullData.length; i++) {
      const { rainIn, rainCm, timestamp } = fullData[i];

      // add rolling sum and subtract prev value
      sumIn += rainIn;
      sumCm += rainCm;

      if (pointCount == MINUTE_RATE_INTERVAL) {  // 5 min currently
        sumIn -= fullData[i - MINUTE_RATE_INTERVAL].rainIn;
        sumCm -= fullData[i - MINUTE_RATE_INTERVAL].rainCm;
      } else pointCount++;

      var minuteRateUpscale = MINUTE_RATE_INTERVAL / 60;

      if (timestamp > start)
        returnData.push({
          rainIn,
          rainCm,
          rateIn: sumIn / minuteRateUpscale,
          rateCm: sumCm / minuteRateUpscale,
          timestamp
        });
    }

    return returnData;
  })
} 

const tempStats = (req, res, next) => {
  fetchQueryFromDatabase('Temperature', [ 'TempF', 'TempC', 'Humidity' ], req, res, data => data.map(d => ({
    tempF: Number(d.TempF),
    tempC: Number(d.TempC),
    humidity: Number(d.Humidity),
    timestamp: new Date(d.Timestamp)
  })))
}

const windStats = (req, res, next) => {
  fetchQueryFromDatabase('WindSpeed', [ 'AvgMph', 'AvgKmh', 'GustMph', 'GustKmh' ], req, res, data => data.map(d => ({
    avgMph: Number(d.AvgMph),
    avgKmh: Number(d.AvgKmh),
    gustMph: Number(d.GustMph),
    gustKmh: Number(d.GustKmh),
    timestamp: new Date(d.Timestamp)
  })))
}

const pressureStats = (req, res, next) => {
  fetchQueryFromDatabase('AirPressure', [ 'Pressure' ], req, res, data => data.map(d => ({
    pressure: Number(d.Pressure) / 100,
    timestamp: new Date(d.Timestamp)
  })))
}

// Router
const statsRouter = Router()

statsRouter.get('/rain', rainStats)
statsRouter.get('/temp', tempStats)
statsRouter.get('/wind', windStats)
statsRouter.get('/pressure', pressureStats)

module.exports = {
  statsRouter
}