<template>
  <v-app>
    <v-main>
      <v-container>
        <v-row>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-title>Состояние</v-card-title>
              <v-card-text>
                <v-alert :type="websocketAlertType" dense outlined>
                  {{ websocketStatusText }}
                </v-alert>

                <v-alert :type="scrapeAlertType" dense outlined>
                  {{ scrapeStatus.message }}
                </v-alert>

                <v-btn
                  color="primary"
                  block
                  :loading="scrapeStatus.isRunning"
                  :disabled="scrapeStatus.isRunning"
                  @click="startScrape"
                >
                  Запустить scraping
                </v-btn>

                <v-list dense class="mt-4">
                  <v-list-item>
                    <v-list-item-content>Последний успешный запуск</v-list-item-content>
                    <v-list-item-action-text>{{ formatDate(scrapeStatus.lastSuccessAt) }}</v-list-item-action-text>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>Последний старт</v-list-item-content>
                    <v-list-item-action-text>{{ formatDate(scrapeStatus.startedAt) }}</v-list-item-action-text>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>Последнее завершение</v-list-item-content>
                    <v-list-item-action-text>{{ formatDate(scrapeStatus.finishedAt) }}</v-list-item-action-text>
                  </v-list-item>
                </v-list>

                <v-divider class="my-4" />

                <div class="text-subtitle-1 mb-2">Итоги последнего прохода</div>
                <v-chip-group column>
                  <v-chip small label>Категории: {{ lastSummary.categories }}</v-chip>
                  <v-chip small label>Разделы: {{ lastSummary.forums }}</v-chip>
                  <v-chip small label>Подразделы: {{ lastSummary.subforums }}</v-chip>
                  <v-chip small label>Всего узлов: {{ lastSummary.total }}</v-chip>
                  <v-chip small label>Новых: {{ lastSummary.inserted }}</v-chip>
                  <v-chip small label>Обновлено: {{ lastSummary.updated }}</v-chip>
                  <v-chip small label>Без изменений: {{ lastSummary.unchanged }}</v-chip>
                </v-chip-group>

                <v-alert
                  v-if="scrapeStatus.lastError"
                  type="error"
                  dense
                  outlined
                  class="mt-4"
                >
                  {{ scrapeStatus.lastError.message }}
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="8">
            <v-card>
              <v-card-title class="d-flex justify-space-between align-center">
                <span>Дерево разделов</span>
                <div>
                  <v-chip small label class="mr-2">Всего: {{ snapshot.totalNodes }}</v-chip>
                  <v-chip small label>Снимок: {{ formatDate(snapshot.generatedAt) }}</v-chip>
                </div>
              </v-card-title>
              <v-card-text>
                <v-treeview
                  :items="snapshot.tree"
                  item-key="externalId"
                  item-text="title"
                  open-all
                  hoverable
                  transition
                >
                  <template #prepend="{ item }">
                    <v-icon small>{{ iconForNode(item.type) }}</v-icon>
                  </template>

                  <template #label="{ item }">
                    <div>
                      <div>{{ item.title }}</div>
                      <div v-if="item.description" class="text-caption">
                        {{ item.description }}
                      </div>
                      <div class="text-caption">
                        <a :href="item.url" target="_blank" rel="noopener noreferrer">
                          {{ item.url }}
                        </a>
                      </div>
                    </div>
                  </template>
                </v-treeview>

                <v-alert
                  v-if="snapshot.tree.length === 0"
                  type="info"
                  dense
                  outlined
                >
                  Данные ещё не загружены. После старта backend автоматически выполнит первый scraping.
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  name: "App",
  data() {
    return {
      reconnectTimer: null,
      socket: null,
      socketState: "connecting",
      scrapeStatus: {
        state: "idle",
        isRunning: false,
        message: "Ожидание подключения к серверу...",
        startedAt: null,
        finishedAt: null,
        lastSuccessAt: null,
        lastSummary: null,
        lastError: null
      },
      snapshot: {
        generatedAt: null,
        totalNodes: 0,
        categories: 0,
        forums: 0,
        subforums: 0,
        tree: []
      }
    };
  },
  computed: {
    websocketAlertType() {
      if (this.socketState === "open") {
        return "success";
      }

      if (this.socketState === "closed") {
        return "warning";
      }

      return "info";
    },
    websocketStatusText() {
      if (this.socketState === "open") {
        return "WebSocket подключён.";
      }

      if (this.socketState === "closed") {
        return "WebSocket переподключается...";
      }

      return "Подключение к WebSocket...";
    },
    scrapeAlertType() {
      if (this.scrapeStatus.state === "completed") {
        return "success";
      }

      if (this.scrapeStatus.state === "error") {
        return "error";
      }

      if (this.scrapeStatus.state === "running") {
        return "warning";
      }

      return "info";
    },
    lastSummary() {
      return (
        this.scrapeStatus.lastSummary || {
          categories: 0,
          forums: 0,
          subforums: 0,
          total: 0,
          inserted: 0,
          updated: 0,
          unchanged: 0
        }
      );
    }
  },
  created() {
    this.connectWebSocket();
  },
  beforeDestroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.socket) {
      this.socket.close();
    }
  },
  methods: {
    connectWebSocket() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

      this.socket = socket;
      this.socketState = "connecting";

      socket.onopen = () => {
        this.socketState = "open";
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "status") {
          this.scrapeStatus = {
            ...this.scrapeStatus,
            ...message.payload
          };
          return;
        }

        if (message.type === "tree_snapshot") {
          this.snapshot = message.payload;
        }
      };

      socket.onerror = () => {
        this.socketState = "closed";
      };

      socket.onclose = () => {
        this.socketState = "closed";
        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket();
        }, 3000);
      };
    },
    async startScrape() {
      try {
        const response = await fetch("/api/scrape/run", {
          method: "POST"
        });
        const payload = await response.json();

        if (!response.ok && response.status !== 409) {
          throw new Error(payload.message || "Не удалось запустить scraping.");
        }

        if (payload.status) {
          this.scrapeStatus = {
            ...this.scrapeStatus,
            ...payload.status
          };
        }
      } catch (error) {
        this.scrapeStatus = {
          ...this.scrapeStatus,
          state: "error",
          message: error.message,
          lastError: {
            message: error.message,
            occurredAt: new Date().toISOString()
          }
        };
      }
    },
    formatDate(value) {
      if (!value) {
        return "n/a";
      }

      return new Date(value).toLocaleString("ru-RU");
    },
    iconForNode(type) {
      if (type === "category") {
        return "mdi-folder-multiple";
      }

      if (type === "forum") {
        return "mdi-folder";
      }

      return "mdi-file-tree";
    }
  }
};
</script>
