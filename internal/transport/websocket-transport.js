/**
 * WebSocket Transport for Wails — Browser Dev Mode
 *
 * Replaces the default HTTP fetch transport with WebSocket-based IPC,
 * allowing the Yanta app to be accessed from a browser during development.
 *
 * Adapted from the Wails v3 websocket-transport example.
 */

console.log("[BrowserDev] Loading WebSocket transport");

import { clientId } from "/wails/runtime.js";

/**
 * Generate a unique ID (simplified nanoid)
 */
function nanoid(size = 21) {
  const alphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let id = "";
  let i = size;
  while (i--) {
    id += alphabet[(Math.random() * 64) | 0];
  }
  return id;
}

/**
 * WebSocket Transport class
 */
export class WebSocketTransport {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.wsReady = false;
    this.pendingRequests = new Map();
    this.messageQueue = [];
    this.reconnectTimer = null;
    this.reconnectDelay = options.reconnectDelay || 2000;
    this.requestTimeout = options.requestTimeout || 30000;
    this.maxQueueSize = options.maxQueueSize || 100;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`[BrowserDev] ✓ Connected to ${this.url}`);
        this.wsReady = true;

        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.ws.send(JSON.stringify(msg));
        }

        resolve();
      };

      this.ws.onmessage = async (event) => {
        let data = event.data;
        if (data instanceof Blob) {
          data = await data.text();
        }
        this.handleMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error("[BrowserDev] WebSocket error:", error);
        this.wsReady = false;
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("[BrowserDev] Disconnected");
        this.wsReady = false;

        this.pendingRequests.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(new Error("WebSocket connection closed"));
        });
        this.pendingRequests.clear();
        this.messageQueue = [];

        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log("[BrowserDev] Attempting to reconnect...");
            this.connect().catch(err => {
              console.error("[BrowserDev] Reconnection failed:", err);
            });
          }, this.reconnectDelay);
        }
      };
    });
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "response" && msg.id) {
        const pending = this.pendingRequests.get(msg.id);
        if (!pending) {
          console.warn("[BrowserDev] No pending request for ID:", msg.id);
          return;
        }

        this.pendingRequests.delete(msg.id);
        clearTimeout(pending.timeout);

        const response = msg.response;
        if (!response) {
          pending.reject(new Error("Invalid response: missing response field"));
          return;
        }

        if (response.statusCode === 200) {
          pending.resolve(response.data ?? undefined);
        } else {
          pending.reject(new Error(response.data));
        }
      } else if (msg.type === "event") {
        if (msg.event && window._wails?.dispatchWailsEvent) {
          window._wails.dispatchWailsEvent(msg.event);
        }
      }
    } catch (err) {
      console.error("[BrowserDev] Failed to parse message:", err);
    }
  }

  async call(objectID, method, windowName, args) {
    if (!this.wsReady) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const msgID = nanoid();

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(msgID)) {
          this.pendingRequests.delete(msgID);
          reject(new Error(`Request timeout (${this.requestTimeout}ms)`));
        }
      }, this.requestTimeout);

      this.pendingRequests.set(msgID, { resolve, reject, timeout });

      const message = {
        id: msgID,
        type: "request",
        request: {
          object: objectID,
          method: method,
          args: args,
          windowName: windowName || undefined,
          clientId: clientId,
        },
      };

      if (this.wsReady && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        if (this.messageQueue.length >= this.maxQueueSize) {
          reject(new Error("Message queue full"));
          return;
        }
        this.messageQueue.push(message);
        this.connect().catch(reject);
      }
    });
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsReady = false;
  }

  isConnected() {
    return this.wsReady && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Auto-connect using the current page's host (works regardless of port).
const wsUrl = `ws://${window.location.host}/wails/ws`;
const wsTransport = await createWebSocketTransport(wsUrl, {
  reconnectDelay: 2000,
  requestTimeout: 30000,
});

export async function createWebSocketTransport(url, options = {}) {
  const transport = new WebSocketTransport(url, options);
  await transport.connect();
  return transport;
}

export default wsTransport;
