import Constants from 'expo-constants';

interface AppConfig {
    apiUrl: string;
    googleMapsApiKey: string; // Include API key here if used directly
}

// Get API_URL from app.config.ts extra field
// Ensure Constants.expoConfig and Constants.expoConfig.extra are not null before accessing
const apiUrlFromConfig = Constants.expoConfig?.extra?.API_URL as string | undefined;

const dev: AppConfig = {
    apiUrl: apiUrlFromConfig || "http://10.30.118.2:3000/api", // Fallback for dev
    googleMapsApiKey: "AIzaSyBxRrmaaB7iOzxJ6a996auq2ypLMm39b5c", // Replace with your actual key
};

const prod: AppConfig = {
    apiUrl: apiUrlFromConfig || "https://bluxurybackend.onrender.com/api", // Replace with your production URL
    googleMapsApiKey: "AIzaSyBxRrmaaB7iOzxJ6a996auq2ypLMm39b5c", // Replace with your actual key
};

// Use __DEV__ global variable to determine the environment
const appConfig = __DEV__ ? dev : prod;

export default appConfig;
