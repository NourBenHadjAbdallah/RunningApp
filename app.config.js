// app.config.js
//
// Expo SDK 49+ automatically loads .env and .env.local before evaluating
// this file, so process.env already has your EXPO_PUBLIC_* variables here.
// No manual dotenv call needed.

/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json').expo

module.exports = {
  expo: {
    ...appJson,
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
}