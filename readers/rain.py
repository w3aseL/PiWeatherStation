from gpiozero import Button
from scheduler import TimeUnit, Task, Interval, Scheduler
import time
from datetime import datetime
import json
from os import path
import requests
# import schedule

RAIN_PIN = 6
COUNT_TO_MM = 0.2794
CM_TO_MM = 10.0
CM_TO_IN = 2.54
SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

data = {}

rain_sensor = Button(RAIN_PIN, True)
rain_count = 0

rain_counts = []

def record():
    global rain_count
    rain_count = rain_count + 1

def calculate_rates_and_total(count):
    cm = count * COUNT_TO_MM / CM_TO_MM
    cmh = cm

    return (cm, cm / CM_TO_IN, cmh, cmh / CM_TO_IN)

def reset_rain():
    global rain_count
    rain_counts.append(rain_count)
    rain_count = 0

def get_local_datetime():
    return datetime.now().astimezone()

def insert_data_into_datafile(data):
    filename = f'./data/rain/{get_local_datetime().astimezone().strftime("%m-%d-%Y")}-rain.json'

    fileData = {}
    loadedFile = False

    if path.exists(filename):
        with open(filename, 'r') as fr:
            try:
                fileData = json.load(fr)
                loadedFile = True
            except Exception as e:
                print(e)

    with open(filename, 'w+') as f:
        if not loadedFile:
            fileData['date'] = get_local_datetime().strftime("%m-%d-%Y")
            fileData['data'] = []
        
        fileData['data'].append(data)

        json.dump(fileData, f)

def write_data_to_file():
    global rain_counts
    final_wind_data = rain_counts
    rain_counts = []

    data['timestamp'] = get_local_datetime().isoformat()
    data['rainData'] = final_wind_data

    insert_data_into_datafile(data)

def send_data_to_server():
    global rain_counts
    final_rain_data = rain_counts
    rain_counts = []

    rain_sum = sum(final_rain_data)

    (cm, rin, cmh, inhr) = calculate_rates_and_total(rain_sum)

    try:
        res = requests.post(f'http://localhost:{SERVER_PORT}/readers/rain', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'inHr': inhr, 'cmHr': cmh, 'rin': rin, 'cm': cm })

        if res.status_code > 400:
            print('received 400 status code')
            print(res)
    except:
        print('Failed to post data to server')

# schedule tracking task
rain_sensor.when_pressed = record
    
scheduler = Scheduler()

scheduler.addTask(Task(Interval(TimeUnit.SECOND, 15), reset_rain))
scheduler.addTask(Task(Interval(TimeUnit.MINUTE, 1), send_data_to_server, True))

while True:
    scheduler.queueTasks()
    scheduler.runReadyTasks()

    time.sleep(0.001)

# sleeptime = 60 - datetime.utcnow().second
# time.sleep(sleeptime)

# print('starting rain schedule')

# schedule.every(15).seconds.do(reset_rain)
# schedule.every(1).minute.do(send_data_to_server)
# schedule.every(1).hour.do(jobReport)

# while True:
#     schedule.run_pending()

#     time.sleep(0.01)

# requests.post('http://localhost:3000/readers/rain', json = { 'kmh': kmh_speed, 'mph': mph_speed })