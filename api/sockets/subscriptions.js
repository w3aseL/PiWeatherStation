const { WebSocket, Server } = require('ws');

/** @type {Server} */
var wsServer = null;
var subscribableEvents = [];
var activeSubscriptions = [];

/**
 * @param {Server} server 
 */
const setWebSocketServer = server => {
  wsServer = server;
};

/**
 * @param {string} event
 */
const registerEvent = (event) => {
  if (!subscribableEvents.includes(event))
    subscribableEvents.push(event);
}

/**
 * @param {string} userIdentifier 
 * @param {string} event 
 */
const subscribeUserToEvent = (userIdentifier, event) => {
  if (!subscribableEvents.includes(event))
    throw new Error(`Event with name "${event}" does not exist.`);

  for(var i = 0; i < activeSubscriptions.length; i++) {
    var { id, subscriptions } = activeSubscriptions[i];

    if(id == userIdentifier) {
      if (!subscriptions.includes(event))
        subscriptions.push(event);

      return;
    }
  }

  activeSubscriptions.push({
    id: userIdentifier,
    subscriptions: [ event ]
  });
}

/**
 * @param {string} userIdentifier 
 * @param {string} event 
 */
const unsubscribeUserFromEvent = (userIdentifier, event) => {
  if (!subscribableEvents.includes(event))
    throw new Error(`Event with name "${event}" does not exist.`);

  for(var i = 0; i < activeSubscriptions.length; i++) {
    var { id, subscriptions } = activeSubscriptions[i];

    if(id == userIdentifier) {
      if (subscriptions.includes(event))
        subscriptions.splice(subscriptions.indexOf(event), 1);
      else
        throw new Error(`User is not subscribed to event with name "${event}"!`);

      return;
    }
  }

  throw new Error(`User is not subscribed to event with name "${event}"!`);
}

/**
 * @param {string} userIdentifier 
 */
const closeUserSubscriptions = (userIdentifier) => {
  activeSubscriptions = activeSubscriptions.filter(({ id }) => id != userIdentifier);
}

/**
 * @param {string} userIdentifier 
 * @param {string} event 
 */
const isSubscribed = (userIdentifier, event) => {
  for(var i = 0; i < activeSubscriptions.length; i++) {
    var { id, subscriptions } = activeSubscriptions[i];

    if (id == userIdentifier) {
      return subscriptions.includes(event);
    }
  }

  return false;
}

/**
 * @param {string} event 
 * @param {{}} payload 
 * @param {bool} forceEmit
 */
const emitEvent = (event, payload, forceEmit=false) => {
  wsServer.clients.forEach(ws => {
    if (forceEmit || isSubscribed(ws.clientId, event))
      ws.json({ type: event, payload });
  });
}

const getSubscribableEvents = () => subscribableEvents

module.exports = {
  setWebSocketServer,
  registerEvent,
  emitEvent,
  closeUserSubscriptions,
  getSubscribableEvents,
  subscribeUserToEvent,
  unsubscribeUserFromEvent
};