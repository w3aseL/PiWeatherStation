const express = require('express');
const { createServer } = require('http');
const { parse } = require('url');
const { WebSocketServer } = require('ws');

require('dotenv').config();

const { verifyToken, getCurrentStatus, updateWind, updateRain, updateTemp, updateWindDir, updatePressure } = require('./data');
const { initPort, genRouter } = require('./gen');
const { statsRouter } = require('./stats');
const { processNewConnection, registerRequest } = require('./sockets');
const { setWebSocketServer } = require('./sockets/subscriptions');

const app = express()
const port = process.env.ENVIRONMENT === "production" ? 3000 : 8080;
const activeVersion = '0.0.2';

app.use(express.json());
app.use(express.static('static'));

app.get('/api', (req, res) => {
  res.status(200).send({
    version: `v${activeVersion}`,
    time: new Date(),
    ...getCurrentStatus()
  });
});

app.get('/api/latest', (req, res) => {
  res.status(200).send({
    version: `v${activeVersion}`,
    time: new Date(),
    ...getCurrentStatus()
  });
});

registerRequest("api-version", (_, ws) => {
  ws.json({ type: "data", payload: { eventName: "api-version", data: activeVersion } });
});

app.post('/readers/wind', verifyToken, updateWind);
app.post('/readers/rain', verifyToken, updateRain);
app.post('/readers/temp', verifyToken, updateTemp);
app.post('/readers/dir', verifyToken, updateWindDir);
app.post('/readers/pressure', verifyToken, updatePressure);

app.use('/stats', statsRouter);

app.use('/gen', genRouter);

const wsServer = new WebSocketServer({
  noServer: true
});

wsServer.on('connection', processNewConnection);

setWebSocketServer(wsServer);

// set port for gen router
initPort(port);

const server = createServer(app)

server.on('upgrade', function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);

  if (pathname === '/ws') {
    wsServer.handleUpgrade(request, socket, head, function done(ws) {
      wsServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`API and WebSocket server listening on port ${port}`);
});