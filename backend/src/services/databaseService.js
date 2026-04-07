const EventEmitter = require("events");
const mongoose = require("mongoose");

class DatabaseService extends EventEmitter {
  constructor({ mongoUri, dbName, retryDelayMs, logger }) {
    super();
    this.mongoUri = mongoUri;
    this.dbName = dbName;
    this.retryDelayMs = retryDelayMs;
    this.logger = logger;
    this.retryTimer = null;
    this.isConnecting = false;
    this.lastConnectedAt = null;
    this.lastError = null;
    this.listenersBound = false;
  }

  bindListeners() {
    if (this.listenersBound) {
      return;
    }

    this.listenersBound = true;

    mongoose.connection.on("connected", () => {
      this.lastConnectedAt = new Date();
      this.lastError = null;
      this.logger.info("MongoDB connected.");
      this.emit("connected");
    });

    mongoose.connection.on("disconnected", () => {
      this.logger.warn("MongoDB disconnected. Will retry.");
      this.emit("disconnected");
      this.scheduleReconnect();
    });

    mongoose.connection.on("error", (error) => {
      this.lastError = {
        message: error.message,
        occurredAt: new Date().toISOString()
      };
      this.logger.error(`MongoDB error: ${error.message}`);
    });
  }

  async start() {
    this.bindListeners();
    await this.tryConnect();
  }

  async tryConnect() {
    if (this.isConnected() || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      await mongoose.connect(this.mongoUri, {
        dbName: this.dbName,
        serverSelectionTimeoutMS: 5000
      });
    } catch (error) {
      this.lastError = {
        message: error.message,
        occurredAt: new Date().toISOString()
      };
      this.logger.error(`Unable to connect to MongoDB: ${error.message}`);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  scheduleReconnect() {
    if (this.retryTimer || this.isConnected()) {
      return;
    }

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      await this.tryConnect();
    }, this.retryDelayMs);

    if (typeof this.retryTimer.unref === "function") {
      this.retryTimer.unref();
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  getStatus() {
    if (this.isConnected()) {
      return {
        state: "connected",
        lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : null,
        lastError: this.lastError
      };
    }

    if (this.isConnecting || mongoose.connection.readyState === 2) {
      return {
        state: "connecting",
        lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : null,
        lastError: this.lastError
      };
    }

    return {
      state: "disconnected",
      lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : null,
      lastError: this.lastError
    };
  }
}

module.exports = {
  DatabaseService
};
