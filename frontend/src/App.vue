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
                  <v-chip small label>Категории: {{ lastForumSummary.categories }}</v-chip>
                  <v-chip small label>Разделы: {{ lastForumSummary.forums }}</v-chip>
                  <v-chip small label>Подразделы: {{ lastForumSummary.subforums }}</v-chip>
                  <v-chip small label>Всего узлов: {{ lastForumSummary.total }}</v-chip>
                  <v-chip small label>Новых: {{ lastForumSummary.inserted }}</v-chip>
                  <v-chip small label>Обновлено: {{ lastForumSummary.updated }}</v-chip>
                  <v-chip small label>Без изменений: {{ lastForumSummary.unchanged }}</v-chip>
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

            <v-card class="mt-4">
              <v-card-title>Топики</v-card-title>
              <v-card-text>
                <v-alert type="info" dense outlined>
                  {{ selectedSubforumInfoText }}
                </v-alert>

                <v-alert :type="topicScrapeAlertType" dense outlined>
                  {{ topicScrapeStatus.message }}
                </v-alert>

                <v-btn
                  color="primary"
                  block
                  :loading="topicScrapeStatus.isRunning"
                  :disabled="topicScrapeStatus.isRunning || !selectedSubforum"
                  @click="startTopicScrape"
                >
                  Загрузить топики
                </v-btn>

                <v-list dense class="mt-4">
                  <v-list-item>
                    <v-list-item-content>Выбранный узел</v-list-item-content>
                    <v-list-item-action-text>{{ selectedSubforum ? selectedSubforum.title : "не выбран" }}</v-list-item-action-text>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>Загружено топиков</v-list-item-content>
                    <v-list-item-action-text>{{ selectedSubforumTopicsCount }}</v-list-item-action-text>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>Последний успешный запуск</v-list-item-content>
                    <v-list-item-action-text>{{ formatDate(topicScrapeStatus.lastSuccessAt) }}</v-list-item-action-text>
                  </v-list-item>
                </v-list>

                <v-divider class="my-4" />

                <div class="text-subtitle-1 mb-2">Итоги последнего topic-scrape</div>
                <v-chip-group column>
                  <v-chip small label>Узел: {{ lastTopicSummary.subforumTitle || "n/a" }}</v-chip>
                  <v-chip small label>Лимит: {{ lastTopicSummary.maxTopics }}</v-chip>
                  <v-chip small label>Найдено: {{ lastTopicSummary.discoveredTopics }}</v-chip>
                  <v-chip small label>Обработано: {{ lastTopicSummary.processedTopics }}</v-chip>
                  <v-chip small label>Новых: {{ lastTopicSummary.inserted }}</v-chip>
                  <v-chip small label>Обновлено: {{ lastTopicSummary.updated }}</v-chip>
                  <v-chip small label>Без изменений: {{ lastTopicSummary.unchanged }}</v-chip>
                  <v-chip small label>Ошибок: {{ lastTopicSummary.failedTopics }}</v-chip>
                </v-chip-group>

                <v-alert
                  v-if="topicScrapeStatus.lastError"
                  type="error"
                  dense
                  outlined
                  class="mt-4"
                >
                  {{ topicScrapeStatus.lastError.message }}
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
                <v-alert type="info" dense outlined class="mb-4">
                  Клик по подразделу или конечному разделу выбирает его для загрузки топиков. Если топики уже сохранены, рядом появится кнопка открытия модального окна.
                </v-alert>

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
                    <div class="d-flex justify-space-between align-center w-100" @click.stop="selectSubforum(item)">
                      <div class="pr-4">
                        <div class="d-flex align-center">
                          <span>{{ item.title }}</span>
                          <v-chip
                            v-if="isSelectedSubforum(item)"
                            x-small
                            color="primary"
                            class="ml-2"
                          >
                            Выбран
                          </v-chip>
                          <v-chip
                            v-if="loadedTopicsCount(item.externalId) > 0"
                            x-small
                            label
                            class="ml-2"
                          >
                            {{ loadedTopicsCount(item.externalId) }}
                          </v-chip>
                        </div>
                        <div v-if="item.description" class="text-caption">
                          {{ item.description }}
                        </div>
                        <div class="text-caption">
                          <a :href="item.url" target="_blank" rel="noopener noreferrer">
                            {{ item.url }}
                          </a>
                        </div>
                      </div>

                      <v-btn
                        v-if="isTopicSourceNode(item) && loadedTopicsCount(item.externalId) > 0"
                        small
                        text
                        color="primary"
                        @click.stop="openTopicsModal(item)"
                      >
                        Топики
                      </v-btn>
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

        <v-dialog v-model="topicsDialog.isOpen" max-width="1200">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>Топики: {{ topicsDialog.subforumTitle }}</span>
              <v-btn icon @click="topicsDialog.isOpen = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-card-title>
            <v-card-text>
              <v-alert type="info" dense outlined>
                Всего топиков: {{ topicsDialog.total }}
              </v-alert>

              <v-progress-linear
                v-if="topicsDialog.loading"
                indeterminate
                color="primary"
                class="mb-4"
              />

              <v-expansion-panels v-if="topicsDialog.items.length > 0" multiple>
                <v-expansion-panel
                  v-for="topic in topicsDialog.items"
                  :key="topic.topicId"
                >
                  <v-expansion-panel-header>
                    <div>
                      <div>{{ topic.title }}</div>
                      <div class="text-caption">
                        {{ topic.authorNickname }} • {{ formatDate(topic.releaseDate) }} • Спасибо: {{ (topic.thankedUsers || []).length }}
                      </div>
                    </div>
                  </v-expansion-panel-header>
                  <v-expansion-panel-content>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-content>Дата релиза</v-list-item-content>
                        <v-list-item-action-text>{{ formatDate(topic.releaseDate) }}</v-list-item-action-text>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-content>Автор</v-list-item-content>
                        <v-list-item-action-text>{{ topic.authorNickname }}</v-list-item-action-text>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-content>Поблагодарившие</v-list-item-content>
                        <v-list-item-action-text>{{ (topic.thankedUsers || []).length }}</v-list-item-action-text>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-content>Тема</v-list-item-content>
                        <v-list-item-action-text>
                          <a :href="topic.url" target="_blank" rel="noopener noreferrer">
                            открыть
                          </a>
                        </v-list-item-action-text>
                      </v-list-item>
                    </v-list>

                    <div class="text-subtitle-2 mt-4 mb-2">Magnet-ссылки</div>
                    <v-chip-group column>
                      <v-chip
                        v-for="(link, index) in topic.magnetLinks"
                        :key="`${topic.topicId}-magnet-${index}`"
                        small
                        label
                      >
                        <a :href="link" target="_blank" rel="noopener noreferrer">magnet {{ index + 1 }}</a>
                      </v-chip>
                      <v-chip v-if="topic.magnetLinks.length === 0" small label>
                        отсутствуют
                      </v-chip>
                    </v-chip-group>

                    <div class="text-subtitle-2 mt-4 mb-2">Torrent-файлы</div>
                    <v-chip-group column>
                      <v-chip
                        v-for="(link, index) in topic.torrentLinks"
                        :key="`${topic.topicId}-torrent-${index}`"
                        small
                        label
                      >
                        <a :href="link" target="_blank" rel="noopener noreferrer">torrent {{ index + 1 }}</a>
                      </v-chip>
                      <v-chip v-if="topic.torrentLinks.length === 0" small label>
                        отсутствуют
                      </v-chip>
                    </v-chip-group>

                    <div class="text-subtitle-2 mt-4 mb-2">Последние поблагодарившие</div>
                    <v-chip-group column>
                      <v-chip
                        v-for="(user, index) in (topic.thankedUsers || [])"
                        :key="`${topic.topicId}-thanked-${user.userId || 'unknown'}-${index}`"
                        small
                        label
                      >
                        {{ user.nickname }} ({{ formatShortDate(user.thankedAt) }})
                      </v-chip>
                      <v-chip v-if="(topic.thankedUsers || []).length === 0" small label>
                        отсутствуют
                      </v-chip>
                    </v-chip-group>

                    <div class="text-subtitle-2 mt-4 mb-2">Описание</div>
                    <pre>{{ topic.description }}</pre>
                  </v-expansion-panel-content>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-alert
                v-if="!topicsDialog.loading && topicsDialog.items.length === 0"
                type="info"
                dense
                outlined
                class="mt-4"
              >
                По выбранному узлу пока нет сохранённых топиков.
              </v-alert>

              <div class="d-flex justify-center mt-6">
                <v-pagination
                  v-if="topicsDialog.totalPages > 1"
                  v-model="topicsDialog.page"
                  :length="topicsDialog.totalPages"
                  @input="fetchTopicsPage"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-dialog>
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
      selectedSubforumExternalId: null,
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
      topicScrapeStatus: {
        state: "idle",
        isRunning: false,
        message: "Topic scraper ожидает запуска.",
        subforumExternalId: null,
        subforumTitle: null,
        startedAt: null,
        finishedAt: null,
        lastSuccessAt: null,
        lastSummary: null,
        lastError: null
      },
      topicsSummary: {
        generatedAt: null,
        totalTopics: 0,
        totalSubforums: 0,
        subforums: []
      },
      snapshot: {
        generatedAt: null,
        totalNodes: 0,
        categories: 0,
        forums: 0,
        subforums: 0,
        tree: []
      },
      topicsDialog: {
        isOpen: false,
        loading: false,
        subforumExternalId: null,
        subforumTitle: "",
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
        items: []
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
    topicScrapeAlertType() {
      if (this.topicScrapeStatus.state === "completed") {
        return "success";
      }

      if (this.topicScrapeStatus.state === "error") {
        return "error";
      }

      if (this.topicScrapeStatus.state === "running") {
        return "warning";
      }

      return "info";
    },
    lastForumSummary() {
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
    },
    lastTopicSummary() {
      return (
        this.topicScrapeStatus.lastSummary || {
          subforumTitle: null,
          maxTopics: 0,
          discoveredTopics: 0,
          processedTopics: 0,
          inserted: 0,
          updated: 0,
          unchanged: 0,
          failedTopics: 0
        }
      );
    },
    loadedTopicsMap() {
      return this.topicsSummary.subforums.reduce((map, item) => {
        map[item.subforumExternalId] = item.topicsCount;
        return map;
      }, {});
    },
    selectedSubforum() {
      return this.findNodeByExternalId(this.snapshot.tree, this.selectedSubforumExternalId);
    },
    selectedSubforumInfoText() {
      if (!this.selectedSubforum) {
        return "Выберите подраздел или конечный раздел в дереве справа.";
      }

      return `Выбран узел для загрузки топиков: ${this.selectedSubforum.title}`;
    },
    selectedSubforumTopicsCount() {
      if (!this.selectedSubforum) {
        return 0;
      }

      return this.loadedTopicsCount(this.selectedSubforum.externalId);
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

          if (
            this.selectedSubforumExternalId &&
            !this.findNodeByExternalId(this.snapshot.tree, this.selectedSubforumExternalId)
          ) {
            this.selectedSubforumExternalId = null;
          }

          return;
        }

        if (message.type === "topic_scrape_status") {
          this.topicScrapeStatus = {
            ...this.topicScrapeStatus,
            ...message.payload
          };
          return;
        }

        if (message.type === "topics_summary") {
          this.topicsSummary = message.payload;
          return;
        }

        if (
          message.type === "topic_scrape_result" &&
          this.topicsDialog.isOpen &&
          this.topicsDialog.subforumExternalId === message.payload.subforumExternalId
        ) {
          this.fetchTopicsPage(this.topicsDialog.page);
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
    async startTopicScrape() {
      if (!this.selectedSubforum) {
        return;
      }

      try {
        const response = await fetch("/api/topics/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            subforumExternalId: this.selectedSubforum.externalId
          })
        });
        const payload = await response.json();

        if (!response.ok && response.status !== 409) {
          throw new Error(payload.message || "Не удалось запустить topic-scrape.");
        }

        if (payload.status) {
          this.topicScrapeStatus = {
            ...this.topicScrapeStatus,
            ...payload.status
          };
        }
      } catch (error) {
        this.topicScrapeStatus = {
          ...this.topicScrapeStatus,
          state: "error",
          message: error.message,
          lastError: {
            message: error.message,
            occurredAt: new Date().toISOString()
          }
        };
      }
    },
    selectSubforum(item) {
      if (!this.isTopicSourceNode(item)) {
        return;
      }

      this.selectedSubforumExternalId = item.externalId;
    },
    isSelectedSubforum(item) {
      return this.isTopicSourceNode(item) && item.externalId === this.selectedSubforumExternalId;
    },
    isTopicSourceNode(item) {
      if (!item) {
        return false;
      }

      if (item.type === "subforum") {
        return true;
      }

      return item.type === "forum" && (!item.children || item.children.length === 0);
    },
    loadedTopicsCount(externalId) {
      return this.loadedTopicsMap[externalId] || 0;
    },
    async openTopicsModal(item) {
      this.topicsDialog.isOpen = true;
      this.topicsDialog.subforumExternalId = item.externalId;
      this.topicsDialog.subforumTitle = item.title;
      this.topicsDialog.page = 1;
      this.topicsDialog.items = [];
      this.topicsDialog.total = 0;
      this.topicsDialog.totalPages = 0;
      await this.fetchTopicsPage(1);
    },
    async fetchTopicsPage(page) {
      if (!this.topicsDialog.subforumExternalId) {
        return;
      }

      this.topicsDialog.loading = true;

      try {
        const query = new URLSearchParams({
          subforumExternalId: this.topicsDialog.subforumExternalId,
          page: String(page),
          pageSize: String(this.topicsDialog.pageSize)
        });
        const response = await fetch(`/api/topics?${query.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Не удалось загрузить топики.");
        }

        this.topicsDialog.page = payload.page;
        this.topicsDialog.total = payload.total;
        this.topicsDialog.totalPages = payload.totalPages;
        this.topicsDialog.items = payload.items;
      } catch (error) {
        this.topicsDialog.items = [];
        this.topicsDialog.total = 0;
        this.topicsDialog.totalPages = 0;
        this.topicScrapeStatus = {
          ...this.topicScrapeStatus,
          state: "error",
          message: error.message,
          lastError: {
            message: error.message,
            occurredAt: new Date().toISOString()
          }
        };
      } finally {
        this.topicsDialog.loading = false;
      }
    },
    findNodeByExternalId(nodes, externalId) {
      if (!externalId) {
        return null;
      }

      for (const node of nodes) {
        if (node.externalId === externalId) {
          return node;
        }

        if (node.children && node.children.length > 0) {
          const nestedResult = this.findNodeByExternalId(node.children, externalId);

          if (nestedResult) {
            return nestedResult;
          }
        }
      }

      return null;
    },
    formatDate(value) {
      if (!value) {
        return "n/a";
      }

      return new Date(value).toLocaleString("ru-RU");
    },
    formatShortDate(value) {
      if (!value) {
        return "n/a";
      }

      return new Date(value).toLocaleDateString("ru-RU");
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
