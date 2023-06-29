from gpiozero import Button
import math
from scheduler import TimeUnit, Task, Interval, Scheduler
import time
from datetime import datetime
import json
from os import path
import requests

WIND_PIN = 5
READ_INVERVAL_SEC = 3
RADIUS_CM = 9.0
CM_IN_A_KM = 100000.0
SECS_IN_AN_HOUR = 3600.0
KMH_TO_MPH = 0.621371
ADJUSTMENT = 1.18

SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

data = {}

wind_speed_sensor = Button(WIND_PIN, True)
wind_count = 0

wind_counts = []

def spin():
    global wind_count
    wind_count = wind_count + 1

def calculate_speed(count, time_sec):
    circumference_cm = (2 * math.pi) * RADIUS_CM
    rotations = count / 2.0

    dist_km = (circumference_cm * rotations) / CM_IN_A_KM

    km_per_sec = dist_km / time_sec
    km_per_hour = km_per_sec * SECS_IN_AN_HOUR

    kmh = km_per_hour * ADJUSTMENT
    mph = kmh * KMH_TO_MPH

    return (kmh, mph)

def print_speed_of_interval(count, time_sec):
    kmh_speed = calculate_speed(count, time_sec)
    mph_speed = kmh_speed * 0.621371
    print("{} km/h, {} mph".format(kmh_speed, mph_speed))

def reset_wind():
    global wind_count
    wind_counts.append(wind_count)
    wind_count = 0

def print_current_speed():
    speeds = wind_counts[-5:]
    print_speed_of_interval(sum(speeds), len(speeds))

def get_local_datetime():
    return datetime.now().astimezone()

def insert_data_into_datafile(data):
    filename = f'./data/wind/{get_local_datetime().astimezone().strftime("%m-%d-%Y")}-wind.json'

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
    global wind_counts
    final_wind_data = wind_counts
    wind_counts = []

    data['timestamp'] = get_local_datetime().isoformat()
    data['windData'] = final_wind_data

    insert_data_into_datafile(data)

def consolidate_data_and_send_to_server():
    global wind_counts
    final_wind_data = wind_counts
    wind_counts = []

    max = 0

    for i in range(len(final_wind_data) - READ_INVERVAL_SEC):
        sum = 0

        for j in range(i, i+READ_INVERVAL_SEC):
            sum += final_wind_data[j]

        if sum > max:
            max = sum

    total_sum = 0

    for i in range(len(final_wind_data)):
        total_sum += final_wind_data[i]

    (kmh_speed, mph_speed) = calculate_speed(total_sum, 60)
    (kmh_gust, mph_gust) = calculate_speed(max, READ_INVERVAL_SEC)

    try:
        res = requests.post(f'http://localhost:{SERVER_PORT}/readers/wind', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'kmh': kmh_speed, 'mph': mph_speed, 'kmh_gust': kmh_gust, 'mph_gust': mph_gust })

        if res.status_code > 400:
            print('received 400 status code')
            print(res)
    except:
        print('Failed to post data to server')

# schedule tracking task
wind_speed_sensor.when_pressed = spin
    
scheduler = Scheduler()

scheduler.addTask(Task(Interval(TimeUnit.MINUTE, 1), consolidate_data_and_send_to_server, True))
scheduler.addTask(Task(Interval(TimeUnit.SECOND, 1), reset_wind))

while True:
    scheduler.queueTasks()
    scheduler.runReadyTasks()

    time.sleep(0.001)


# requests.post('http://localhost:3000/readers/wind', json = { 'kmh': kmh_speed, 'mph': mph_speed })