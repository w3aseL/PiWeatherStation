from gpiozero import MCP3008
import time
from scheduler import TimeUnit, Task, Interval, Scheduler
import math
from datetime import datetime
import requests

adc = MCP3008(channel=0)

RESISTANCES = [
    33000, 6570, 8200, 891,
    1000, 688, 2200, 1410,
    3900, 3140, 16000, 14120,
    120000, 42120, 64900, 21880
]

VOLTAGE_DIRECTIONS = [
    0.4, 1.4, 1.2, 2.8,
    2.7, 2.9, 2.2, 2.5,
    1.8, 2.0, 0.7, 0.8,
    0.1, 0.3, 0.2, 0.6
]

DIRECTIONS = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
]

VOLTS = 3.3
OUTPUT_RESISTANCE = 4700
VANE_CALIBRATION_AMOUNT = 0

SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

def findDirByVoltage(voltage):
    idx = 0
    min_diff = 999.0

    for i in range(len(VOLTAGE_DIRECTIONS)):
        # calc_voltage = round((VOLTS * RESISTANCES[i]) / (RESISTANCES[i] + OUTPUT_RESISTANCE), 3) # Series resistance formula
        diff = abs(voltage - VOLTAGE_DIRECTIONS[i])

        if diff < min_diff:
            idx = i
            min_diff = diff

    dirDeg = ((idx * 22.5) + (360 - VANE_CALIBRATION_AMOUNT)) % 360

    return dirDeg

def degToDirection(deg):
    dirIdx = round(deg / 360 * 16) % 16
    return (dirIdx, DIRECTIONS[dirIdx])

def get_average(angles):
    sin_sum = 0.0
    cos_sum = 0.0

    for angle in angles:
        r = math.radians(angle)
        sin_sum += math.sin(r)
        cos_sum += math.cos(r)

    flen = float(len(angles))
    s = sin_sum / flen
    c = cos_sum / flen
    arc = math.degrees(math.atan(s / c))
    average = 0.0

    if s > 0 and c > 0:
        average = arc
    elif c < 0:
        average = arc + 180
    elif s < 0 and c > 0:
        average = arc + 360

    return average % 360.0

angles = []

def read_angle():
    wind = round(adc.value*3.3, 1)
    deg = findDirByVoltage(wind)
    angles.append(deg)

successfulRuns = 0

def calc_average_and_send():
    global successfulRuns
    global angles
    final_angles = angles 
    angles = []

    avg_deg = round(get_average(final_angles), 1)

    (_, dir) = degToDirection(avg_deg)

    try:
        res = requests.post(f'http://localhost:{SERVER_PORT}/readers/dir', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'deg': avg_deg, 'dir': dir })

        if res.status_code > 400:
            print('received 400 status code')
            print(res)

        successfulRuns = successfulRuns + 1
    except:
        print('Failed to post data to server')

def jobReport():
    global successfulRuns

    print(f'[{datetime.now()}] Successful job runs: {successfulRuns}')
    successfulRuns = 0
    
scheduler = Scheduler()

scheduler.addTask(Task(Interval(TimeUnit.SECOND, 1), read_angle))
scheduler.addTask(Task(Interval(TimeUnit.MINUTE, 1), calc_average_and_send))
scheduler.addTask(Task(Interval(TimeUnit.HOUR, 1), jobReport))

while True:
    scheduler.queueTasks()
    scheduler.runReadyTasks()

    time.sleep(0.001)
