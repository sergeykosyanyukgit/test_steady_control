const { WebSocketServer, WebSocket } = require("ws");

class WebSocketHub {
  constructor({ server, path, logger }) {
    this.logger = logger;
    this.connectionHandler = null;
    this.wss = new WebSocketServer({ server, path });

    this.wss.on("connection", (socket) => {
      this.logger.info("WebSocket client connected.");

      socket.on("close", () => {
        this.logger.info("WebSocket client disconnected.");
      });

      socket.on("error", (error) => {
        this.logger.warn(`WebSocket error: ${error.message}`);
      });

      if (this.connectionHandler) {
        Promise.resolve(this.connectionHandler(socket)).catch((error) => {
          this.logger.warn(`WebSocket connection init failed: ${error.message}`);
        });
      }
    });
  }

  onConnection(handler) {
    this.connectionHandler = handler;
  }

  send(socket, type, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type,
        payload,
        sentAt: new Date().toISOString()
      })
    );
  }

  broadcast(type, payload) {
    this.wss.clients.forEach((socket) => {
      this.send(socket, type, payload);
    });
  }
}

module.exports = {
  WebSocketHub
};
