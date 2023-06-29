const chartType = $(`input[name="chart-type"]`).val()
const showRateOfRainfall = getParameterByName("showRate") === 'true';

chartLoaded = false;

const getUrl = port => {
  const splitUrl = window.location.origin.split(':')
  splitUrl.pop()

  return `${splitUrl.join(':')}:${port}`
}

// https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/901144#901144
function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const sumEachIndex = arr => {
  var sum = 0, newArr = []

  for (var i = 0; i < arr.length; i++) {
    sum += arr[i]
    newArr.push(sum)
  }

  return newArr
}

const timeToStr = (time, timezone="America/Chicago", showSec=true) => {
	let options = {
		timeZone: timezone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: showSec ? 'numeric' : undefined
	};

	return time.toLocaleString([], options)
}

const dateToStr = (time, timezone="America/Chicago") => {
	let options = {
		timeZone: timezone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	};

	return time.toLocaleDateString([], options)
}

const addAndRoundToNearestTens = (val, valToAdd, mathFunc=Math.ceil) => {
  return mathFunc((val + valToAdd) / 10) * 10;
};

const getChartOptionsByDataType = (dataType, data) => {
  switch(dataType) {
    case "rain":
      return {
        spanGaps: 60 * 90, // 1.5 hour
        animation: false,
        interaction: {
          mode: 'nearest'
        },
        elements: {
          point: {
            radius: 0.25
          }
        },
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: showRateOfRainfall
          }
        },
        scales: {
          x: {
            type: 'time',
            display: true,
            title: {
              display: false
            },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              major: {
                enabled: true
              },
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Rain (in.)'
            },
            min: 0
          },
          y1: {
            type: 'linear',
            display: showRateOfRainfall,
            title: {
              display: true,
              text: 'Rainfall (in/hr)'
            },
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            min: 0
          }
        }
      }
    case "temp":
      return {
        spanGaps: 60 * 90, // 1.5 hour
        animation: false,
        interaction: {
          mode: 'nearest'
        },
        stacked: false,
        elements: {
          point: {
            radius: 0.25
          }
        },
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: true
          }
        },
        scales: {
          x: {
            type: 'time',
            display: true,
            title: {
              display: false
            },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              major: {
                enabled: true
              },
            }
          },
          y: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: 'Temperature (°F)'
            },
            position: 'left',
            min: addAndRoundToNearestTens(Math.min(...(data.map(d => d.tempF))), -20),
            max: addAndRoundToNearestTens(Math.max(...(data.map(d => d.tempF))), 10)
          },
          y1: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: 'Humidity (%)'
            },
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            min: 0,
            max: 100
          }
        }
      }
    case "wind":
      return {
        spanGaps: 60 * 90, // 1.5 hour
        animation: false,
        interaction: {
          mode: 'nearest'
        },
        stacked: false,
        elements: {
          point: {
            radius: 0.25
          }
        },
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: true
          }
        },
        scales: {
          x: {
            type: 'time',
            display: true,
            title: {
              display: false
            },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              major: {
                enabled: true
              },
            }
          },
          y: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: 'Wind Speed (MPH)'
            },
            position: 'left',
            min: 0,
            max: addAndRoundToNearestTens(Math.max(...(data.map(d => d.gustMph))), 0)
          }
        }
      }
      case "pressure":
        return {
          spanGaps: 60 * 90, // 1.5 hour
          animation: false,
          interaction: {
            mode: 'nearest'
          },
          stacked: false,
          elements: {
            point: {
              radius: 0.25
            }
          },
          plugins: {
            title: {
              display: false,
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              type: 'time',
              display: true,
              title: {
                display: false
              },
              ticks: {
                autoSkip: false,
                maxRotation: 0,
                major: {
                  enabled: true
                },
              }
            },
            y: {
              type: 'linear',
              display: true,
              title: {
                display: true,
                text: 'Pressure (mb)'
              },
              position: 'left',
              min: addAndRoundToNearestTens(Math.max(...(data.map(d => d.pressure))), -10, Math.floor),
              max: addAndRoundToNearestTens(Math.max(...(data.map(d => d.pressure))), 10)
            }
          }
        }
  }
}

const getChartDataByDataType = (data, dataType) => {
  switch(dataType) {
    case "rain":
      return {
        labels: data.map(d => d.timestamp),
        datasets: [
          {
            label: "Rain Total Elapsed (in.)",
            data: sumEachIndex(data.map(d => d.rainIn)),
            showLine: true,
            tension: 0.1,
            spanGaps: true
          },
          (showRateOfRainfall ? {
            label: "Rate of Rainfall (in/hr)",
            data: data.map(d => d.rateIn),
            showLine: true,
            tension: 0.1,
            spanGaps: true,
            yAxisID: 'y1'
          } : null)
        ].filter(ds => ds != null)
      }
    case "temp":
      return {
        labels: data.map(d => d.timestamp),
        datasets: [
          {
            label: "Temperature (°F)",
            data: data.map(d => d.tempF),
            showLine: true,
            tension: 0.1,
            spanGaps: true,
            yAxisID: 'y'
          },
          {
            label: "Humidity (%)",
            data: data.map(d => d.humidity),
            showLine: true,
            tension: 0.1,
            spanGaps: true,
            yAxisID: 'y1'
          }
        ]
      }
    case "wind":
      return {
        labels: data.map(d => d.timestamp),
        datasets: [
          {
            label: "Avg. Wind Speed",
            data: data.map(d => d.avgMph),
            showLine: true,
            tension: 0.1,
            spanGaps: true
          },
          {
            label: "Wind Gust Speed",
            data: data.map(d => d.gustMph),
            showLine: true,
            tension: 0.1,
            spanGaps: true
          }
        ]
      }
    case "pressure":
      return {
        labels: data.map(d => d.timestamp),
        datasets: [
          {
            label: "Pressure (mb)",
            data: data.map(d => d.pressure),
            showLine: true,
            tension: 0.1,
            spanGaps: true
          }
        ]
      }
  }
}

const initializeChart = data => {
  $("#gen-date").text(timeToStr(new Date(), "America/Chicago", false))
  $("#entry-date").text(data.length > 0 ? dateToStr(new Date(data[0].timestamp)) : dateToStr(new Date()))

  new Chart(
    document.getElementById('chart'),
    {
      type: 'line',
      options: getChartOptionsByDataType(chartType, data),
      data: getChartDataByDataType(data, chartType)
    }
  );

  setTimeout(() => chartLoaded = true, 500);
}

/**
 * @param {{}} queryObj 
 * @returns 
 */
 const convertQueriesToQueryString = queryObj =>
  Object.keys(queryObj).filter(key => queryObj[key] !== undefined && queryObj[key] !== null).map(key => `${key}=${encodeURIComponent(queryObj[key])}`).join('&');

const init = () => {
  const date = getParameterByName("date");
  const time_unit = getParameterByName("time_unit");
  const time_amount = getParameterByName("time_amount");
  const span_from = getParameterByName("span_from");

  var queryString = convertQueriesToQueryString({ date, time_unit, time_amount, span_from });

	fetch(`/stats/${chartType}${queryString !== '' ? `?${queryString}` : ''}`)
	.then(res => res.json())
	.then(({ data }) => {
    initializeChart(data);
	})
	.catch(err => console.log(err));
}

init()