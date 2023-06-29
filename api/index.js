const express = require('express')

require('dotenv').config()

const { verifyToken, getCurrentStatus, updateWind, updateRain, updateTemp, updateWindDir, updatePressure } = require('./data')
const { initPort, genRouter } = require('./gen')
const { statsRouter } = require('./stats')
const app = express()
const port = process.env.ENVIRONMENT === "production" ? 3000 : 8080
const activeVersion = '0.0.2'

app.use(express.json());
app.use(express.static('static'))

app.get('/api', (req, res) => {
  res.status(200).send({
    version: `v${activeVersion}`,
    time: new Date(),
    ...getCurrentStatus()
  })
})

app.get('/api/latest', (req, res) => {
  res.status(200).send({
    version: `v${activeVersion}`,
    time: new Date(),
    ...getCurrentStatus()
  })
})

app.post('/readers/wind', verifyToken, updateWind)
app.post('/readers/rain', verifyToken, updateRain)
app.post('/readers/temp', verifyToken, updateTemp)
app.post('/readers/dir', verifyToken, updateWindDir)
app.post('/readers/pressure', verifyToken, updatePressure)

app.use('/stats', statsRouter)

app.use('/gen', genRouter)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

// set port for gen router
initPort(port)