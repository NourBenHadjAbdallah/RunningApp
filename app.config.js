// app.config.js
const appJson = require('./app.json').expo

module.exports = {
  expo: {
    ...appJson,
    ios: {
      bundleIdentifier: "com.itachiblackmoon.runningapp",
    },
    android: {
      package: "com.itachiblackmoon.runningapp",
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: "22dc7afb-658c-43ce-964f-de5b7e957c38"
      }
    }
  },
}