import time
import board
import adafruit_ahtx0
from scheduler import TimeUnit, Task, Interval, Scheduler
from datetime import datetime
import requests

# Create sensor object, communicating over the board's default I2C bus
i2c = board.I2C()  # uses board.SCL and board.SDA
sensor = adafruit_ahtx0.AHTx0(i2c)

MAX_TRY_COUNT = 5

SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

def readAht(tryCount):
    if tryCount == MAX_TRY_COUNT:
        raise Exception("Reached try count on temp read.")
    
    try:
        temp_c = sensor.temperature
        temp_f = temp_c * (9 / 5) + 32
        humidity = sensor.relative_humidity

        return (temp_c, temp_f, humidity)
    except RuntimeError as error:
        print(error)

        time.sleep(2.5)
        return readAht(tryCount + 1)

def performRead():
    try:
        (temp_c, temp_f, humidity) = readAht(0)

        # print(temp_c, temp_f, humidity)

        try:
            res = requests.post(f'http://localhost:{SERVER_PORT}/readers/temp', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'temp_c': temp_c, 'temp_f': temp_f, 'humidity': humidity })

            if res.status_code > 400:
                print('received 400 status code')
                print(res)
        except Exception as e:
            print('Failed to post data to server')
            print(e)
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