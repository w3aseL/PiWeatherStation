var apiData = {
  version: "???",
	time: new Date()
}

// NOT NORMAL QUEUE ONLY FOR UPDATE PURPOSES
var queue = []

const processQueue = () => {
  if (queue.length > 0) {
    while (queue.length > 0) {
      const { type, data } = queue.pop();

      apiData = { ...apiData, [type]: data };
    }

    updateData(true);
  }
}

const queueUpdate =(type, data) => {
  queue.push({ type, data });
}

const ws = new WebSocket(`ws://${window.location.host}/ws`)

const SUBSCRIPTIONS = [ 'update:rain', 'update:wind', 'update:pressure', 'update:direction', 'update:temp' ];

ws.addEventListener('open', e => {
  ws.send(JSON.stringify({ type: "api-version" }));
  ws.send(JSON.stringify({ type: "current-data" }));

  SUBSCRIPTIONS.forEach(v => ws.send(JSON.stringify({ type: "subscribe", payload: v })));
});

const processPayload = payload => {
  const { eventName, data } = payload

  switch (eventName) {
    case "api-version": {
      apiData = { ...apiData, version: data };

      break;
    }
    case "current-data": {
      apiData = { ...apiData, ...data };

      updateData(true);

      break;
    }
  }
}

const processUpdate = (type, data) => {
  var key = null;

  switch (type) {
    case "rain": {
      key = "rain";
      break;
    }
    case "wind": {
      key = "windSpeed";
      break;
    }
    case "pressure": {
      key = "pressure";
      break;
    }
    case "direction": {
      key = "windDir";
      break;
    }
    case "temp": {
      key = "temp";
      break;
    }
  }

  if (key != null) {
    queueUpdate(key, data);
  }
}

ws.addEventListener('message', e => {
  const { type, payload } = JSON.parse(e.data);

  switch(type) {
    case "message": {
      console.log(`[WebSocket Response] "${payload}"`);
      break;
    }
    case "data": {
      processPayload(payload);
      break;
    }
    default: {
      if (type.includes("update")) {
        const updateType = type.split(':')[1];

        processUpdate(updateType, payload);
      } else {
        console.log({ type, payload })
      }
    }
  }
});

const init = () => {
  /*
	fetch("/api")
	.then(res => res.json())
	.then(data => {
		apiData = { ...apiData, ...data, time: new Date() }

		updateData()

		fetchLatest()
	})
	.catch(err => console.log(err))
  */

	setInterval(() => callForUpdates(), 1000)
}

const callForUpdates = () => {
  apiData.time = new Date();

  /*
	if (apiData.time.getSeconds() == 5) {
		fetchLatest()
	}
  */

  processQueue();
	updateData();
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

const fetchLatest = () => {
	fetch("/api/latest")
	.then(res => res.json())
	.then(data => {
		apiData = { ...apiData, ...data }

		updateData(true)
	})
	.catch(err => console.log(err))
}

const getLatestDate = (dateOne, dateTwo) => {
  if (dateOne != null && dateTwo == null)
    return new Date(dateOne)
  else if (dateTwo != null && dateOne == null)
    return new Date(dateTwo)
  
  dateOne = new Date(dateOne)
  dateTwo = new Date(dateTwo)
  
  return dateOne > dateTwo ? dateOne : dateTwo
}

const updateData = (fullUpdate=false) => {
	$("#api-version").text(`API Version: ${apiData.version ? apiData.version : "Unavailable"}`)
	$("#time").text(timeToStr(apiData.time, "America/Chicago"))

	if(fullUpdate) {
		console.log(apiData)

		if(apiData.temp.lastUpdated != null) {
			$("#temp_f").text(apiData.temp.temp_f.toFixed(1))
			$("#temp_c").text(apiData.temp.temp_c.toFixed(1))
			$("#humidity").text(apiData.temp.humidity.toFixed(1))
			$("#temp_last_update").text(timeToStr(new Date(apiData.temp.lastUpdated), "America/Chicago", false))
		}

		if(apiData.windSpeed.lastUpdated != null) {
			$("#wind_mph").text(apiData.windSpeed.mph.toFixed(1))
			$("#wind_kph").text(apiData.windSpeed.kmh.toFixed(1))
      $("#wind_mph_gust").text(apiData.windSpeed.mph_gust.toFixed(1))
			$("#wind_kph_gust").text(apiData.windSpeed.kmh_gust.toFixed(1))
			$("#wind_last_update").text(timeToStr(getLatestDate(apiData.windSpeed.lastUpdated, apiData.windDir.lastUpdated), "America/Chicago", false))
		}

    if(apiData.windDir.lastUpdated != null) {
      $("#dir").text(apiData.windDir.label)
			$("#dir_deg").text(apiData.windDir.dir.toFixed(1))
			$("#wind_last_update").text(timeToStr(getLatestDate(apiData.windSpeed.lastUpdated, apiData.windDir.lastUpdated), "America/Chicago", false))
    }

		if(apiData.rain.lastUpdated != null) {
			$("#rain_in").text(apiData.rain.rain_in_hr.toFixed(2))
			$("#rain_cm").text(apiData.rain.rain_cm_hr.toFixed(2))
      $("#total_in").text(apiData.rain.rain_in.toFixed(2))
			$("#total_cm").text(apiData.rain.rain_cm.toFixed(2))
			$("#rain_last_update").text(timeToStr(new Date(apiData.rain.lastUpdated), "America/Chicago", false))
		}

    if(apiData.pressure.lastUpdated != null) {
      var pressure = apiData.pressure.air / 100
      var seaLvl = apiData.pressure.sea_level / 100

      $("#pres_hpa").text(pressure.toFixed(2))
      $("#pres_mb").text(pressure.toFixed(2))

      $("#slvl_hpa").text(seaLvl.toFixed(2))
      $("#slvl_mb").text(seaLvl.toFixed(2))

      $("#pressure_last_update").text(timeToStr(new Date(apiData.pressure.lastUpdated), "America/Chicago", false))
    }
	}
}

init()