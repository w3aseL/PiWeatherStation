const { WebSocket } = require('ws');
const { v4 } = require('uuid');

var requestProcessors = [];

/**
 * @param {string} requestType 
 * @param {function({}, WebSocket)} requestProcessor 
 */
const registerRequest = (requestType, requestProcessor) => {
  if (requestProcessors.find(({ type }) => type == requestType) === undefined)
    requestProcessors.push({
      type: requestType,
      processor: requestProcessor
    });
};

/**
 * @param {string} requestType 
 * @param {Object} requestPayload 
 * @param {WebSocket} socket
 */
const processRequest = (requestType, requestPayload, socket) => {
  for(var i = 0; i < requestProcessors.length; i++) {
    const { type, processor } = requestProcessors[i];

    if(requestType === type) {
      processor(requestPayload, socket);
      return;
    }
  }

  throw new Error(`Failed to process request with request type "${requestType}"`);
};

/**
 * @param {WebSocket} connection
 */
const processNewConnection = connection => {
  connection.clientId = v4();

  connection.json = obj => connection.send(JSON.stringify(obj));

  connection.on('message', data => {
    try {
      const { type, payload } = JSON.parse(data);

      processRequest(type, payload, connection);
    } catch(e) {
      connection.json({ type: "error", payload: e.message })
    }
  });

  connection.on('close', (code, reason) => {
    console.log(`Closed connection with identifier ${connection.clientId}. Code: ${code} -- Reason: ${reason ?? "N/A"}`);
  });

  connection.json({ type: "message", payload: "Welcome!" });
};

module.exports = {
  processNewConnection,
  registerRequest
};