import time
import board
import adafruit_dht
import schedule
from datetime import datetime
import requests

# Initial the dht device, with data pin connected to:
dhtDevice = adafruit_dht.DHT22(board.D25)

MAX_TRY_COUNT = 5

SERVER_PORT = 3000
ACCESS_TOKEN = "M5nCSgbkvE"

def readDht(tryCount):
    if tryCount == MAX_TRY_COUNT:
        raise Exception("Reached try count on temp read.")
    
    try:
        temp_c = dhtDevice.temperature
        temp_f = temp_c * (9 / 5) + 32
        humidity = dhtDevice.humidity

        return (temp_c, temp_f, humidity)
    except RuntimeError as error:
        # Errors happen fairly often, DHT's are hard to read, just keep going
        print(error.args[0])

        time.sleep(2.5)
        return readDht(tryCount + 1)

def performRead():
    try:
        (temp_c, temp_f, humidity) = readDht(0)

        # print(temp_c, temp_f, humidity)

        try:
            res = requests.post(f'http://localhost:{SERVER_PORT}/readers/temp', headers = { 'Authorization': ACCESS_TOKEN }, json = { 'temp_c': temp_c, 'temp_f': temp_f, 'humidity': humidity })

            if res.status_code > 400:
                print('received 400 status code')
                print(res)
        except:
            print('Failed to post data to server')
    except Exception as e:
        print('got error')
        print(e)
        quit()

sleeptime = 60 - datetime.now().second
time.sleep(sleeptime)

print('starting read schedule...')
    
schedule.every(1).minutes.do(performRead)

while True:
    schedule.run_pending()
    time.sleep(0.01)