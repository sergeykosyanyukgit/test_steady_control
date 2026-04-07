module.exports = {
  transpileDependencies: ["vuetify"],
  devServer: {
    proxy: {
      "^/api": {
        target: process.env.VUE_APP_API_TARGET || "http://localhost:3000",
        changeOrigin: true
      },
      "^/docs": {
        target: process.env.VUE_APP_API_TARGET || "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
};
