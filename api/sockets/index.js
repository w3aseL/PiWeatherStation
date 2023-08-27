const { WebSocket } = require('ws');
const { v4 } = require('uuid');

const { closeUserSubscriptions, registerEvent, emitEvent, setWebSocketServer, getSubscribableEvents, subscribeUserToEvent, unsubscribeUserFromEvent } = require('./subscriptions')

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
    closeUserSubscriptions(connection.clientId);

    console.log(`Closed connection with identifier ${connection.clientId}. Code: ${code} -- Reason: ${reason ?? "N/A"}`);
  });

  connection.json({ type: "message", payload: "Welcome!" });
};

registerRequest("subscribe", (payload, ws) => {
  try {
    subscribeUserToEvent(ws.clientId, payload);

    ws.json({ type: "message", payload: `Subscribed to event "${payload}"!` });
  } catch (e) {
    ws.json({ type: "error", payload: e.message });
  }
});

registerRequest("unsubscribe", (payload, ws) => {
  try {
    unsubscribeUserFromEvent(ws.clientId, payload);

    ws.json({ type: "message", payload: `Unsubscribed from event "${payload}"!` });
  } catch (e) {
    ws.json({ type: "error", payload: e.message });
  }
});

registerRequest("event-list", (_, ws) => {
  ws.json({ type: "data", payload: getSubscribableEvents });
});

module.exports = {
  processNewConnection,
  registerRequest,
  registerEvent,
  emitEvent,
  setWebSocketServer
};