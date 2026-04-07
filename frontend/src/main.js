import Vue from "vue";
import Vuetify from "vuetify";
import App from "./App.vue";
import "vuetify/dist/vuetify.min.css";
import "@mdi/font/css/materialdesignicons.css";

Vue.config.productionTip = false;
Vue.use(Vuetify);

new Vue({
  vuetify: new Vuetify(),
  render: (createElement) => createElement(App)
}).$mount("#app");
