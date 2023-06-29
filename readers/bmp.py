import Adafruit_BMP.BMP085 as BMP085
import requests
import time
from datetime import datetime
from scheduler import TimeUnit, Task, Interval, Scheduler

CUR_ALT = 4.572
SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

sensor = BMP085.BMP085(busnum=1)

def readSensor():
    temp_c = sensor.read_temperature()
    pressure = sensor.read_pressure()
    sea_level = sensor.read_sealevel_pressure(CUR_ALT)

    return (temp_c, pressure, sea_level)

def performRead():
    try:
        (temp_c, pressure, sea_level) = readSensor()

        # print(temp_c, temp_f, humidity)

        try:
            res = requests.post(f'http://localhost:{SERVER_PORT}/readers/pressure', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'temp_c': temp_c, 'pressure': pressure, 'sea_level': sea_level })

            if res.status_code > 400:
                print('received 400 status code')
                print(res)
        except:
            print('Failed to post data to server')
    except Exception as e:
        print('got error')
        print(e)
        quit()
    
scheduler = Scheduler()

scheduler.addTask(Task(Interval(TimeUnit.MINUTE, 1), performRead))

while True:
    scheduler.queueTasks()
    scheduler.runReadyTasks()

    time.sleep(0.001)