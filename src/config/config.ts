// src/config/config.ts - FIXED
import Constants from 'expo-constants';

interface AppConfig {
    apiUrl: string;
    googleMapsApiKey: string;
}

const apiUrlFromConfig = Constants.expoConfig?.extra?.API_URL as string | undefined;

const dev: AppConfig = {
    apiUrl: apiUrlFromConfig || "http://192.168.0.126:3000/api",
    googleMapsApiKey: "AIzaSyBxRrmaaB7iOzxJ6a996auq2ypLMm39b5c",
};

// ✅ FIXED: Use your Render.com production URL
const prod: AppConfig = {
    apiUrl: apiUrlFromConfig || "https://bluxurybackend.onrender.com/api",  // ✅ Your production URL
    googleMapsApiKey: "AIzaSyBxRrmaaB7iOzxJ6a996auq2ypLMm39b5c",
};

const appConfig = __DEV__ ? dev : prod;

export default appConfig;