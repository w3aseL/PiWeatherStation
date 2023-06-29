import time
from datetime import datetime, timedelta
from threading import Thread

EPSILON = timedelta(milliseconds=25)

class TimeUnit:
    SECOND = 'second'
    MINUTE = 'minute'
    HOUR = 'hour'
    DAY = 'day'

class Interval:
    def __init__(self, unit=TimeUnit.MINUTE, amount=1, exact=True):
        self.unit = unit
        self.amount = amount
        self.exact = exact

    def calculateTimeDeltaByUnit(self):
        if self.unit == TimeUnit.SECOND:
            return timedelta(seconds=self.amount)
        elif self.unit == TimeUnit.MINUTE:
            return timedelta(minutes=self.amount)
        elif self.unit == TimeUnit.HOUR:
            return timedelta(hours=self.amount)
        elif self.unit == TimeUnit.DAY:
            return timedelta(days=self.amount)

    def checkIsExactTime(self, curTime):
        if self.unit == TimeUnit.SECOND:
            return curTime.second % self.amount == 0
        elif self.unit == TimeUnit.MINUTE:
            return curTime.minute % self.amount == 0 and curTime.second == 0
        elif self.unit == TimeUnit.HOUR:
            return curTime.hour % self.amount == 0 and curTime.minute == 0 and curTime.second == 0
        elif self.unit == TimeUnit.DAY:
            return curTime.day % self.amount == 0 and curTime.hour == 0 and curTime.minute == 0 and curTime.second == 0

    def passesInterval(self, curTime, lastExecuted):
        isExactPasses = (not self.exact or (self.exact and self.checkIsExactTime(curTime)))

        if lastExecuted == None and isExactPasses:
            return True

        # stopgap for last exectued being none -- will catc when exact minute mark
        if lastExecuted == None:
            return False
        
        delta = self.calculateTimeDeltaByUnit()
        return abs(curTime - lastExecuted - delta) < EPSILON and isExactPasses

class Task:
    def __init__(self, interval, job, runJobInThread = False, *jobArgs):
        self.interval = interval
        self.job = job
        self.timesExecuted = 0
        self.ignoreExecuteCount = False
        self.jobArgs = jobArgs
        self.runJobInThread = runJobInThread

        # set last executed
        self.lastExecuted = None
        self.intendRun = False

    def runTask(self):
        if self.intendRun:
            self.runJob()
            self.intendRun = False

    def attemptQueue(self):
        curTime = datetime.now()

        if self.interval.passesInterval(curTime, self.lastExecuted):
            # print('Running job!')
            self.intendRun = True
            self.lastExecuted = curTime
            self.timesExecuted = self.timesExecuted + 1

    def runJob(self):
        if self.runJobInThread:
            th = Thread(target=self.job, args=self.jobArgs)
            th.start()
        else:
            self.job(*self.jobArgs)

    def resetExecuteCount(self):
        self.timesExecuted = 0

def jobReport(scheduler):
    printStr = f'[{datetime.now()}] Successful run counts -- '

    for i in range(len(scheduler.tasks)):
        if not scheduler.tasks[i].ignoreExecuteCount:
            printStr = printStr + f'Task{i}: {scheduler.tasks[i].timesExecuted}, '

        scheduler.tasks[i].resetExecuteCount()


    print(printStr)

class Scheduler:
    def __init__(self):
        self.tasks = []

        reportTask = Task(Interval(TimeUnit.HOUR, 1), jobReport, False, self)
        reportTask.ignoreExecuteCount = True

        self.addTask(reportTask)

    def addTask(self, task):
        self.tasks.append(task)

        print(f'Scheduled task with interval of every {task.interval.amount} {task.interval.unit}')

    def queueTasks(self):
        for task in self.tasks:
            task.attemptQueue()

    def runReadyTasks(self):
        for task in self.tasks:
            task.runTask()

    

# solo running
if __name__ == "__main__":
    testCounter = 0
    
    def incrementCounter():
        global testCounter
        testCounter = testCounter + 1

    def resetCounter():
        global testCounter
        print(f"[{datetime.now()}] Counter: {testCounter}")
        testCounter = 0
        time.sleep(0.5)

    scheduler = Scheduler()

    scheduler.addTask(Task(Interval(TimeUnit.SECOND, 1), incrementCounter, False))
    scheduler.addTask(Task(Interval(TimeUnit.HOUR, 1), resetCounter, True))

    while True:
        scheduler.queueTasks()
        scheduler.runReadyTasks()

        time.sleep(0.001)