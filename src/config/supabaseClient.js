// FILE: src/config/supabaseClient.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual project keys from Supabase Dashboard -> Settings -> API
const SUPABASE_URL = "https://mtcogzlhskhwgvyaszsg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Y29nemxoc2tod2d2eWFzenNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDk0ODAsImV4cCI6MjA4NTYyNTQ4MH0.ACq97whJPMKAX3feZIel1-kcPlIP0o8p81bg1q3afq8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});