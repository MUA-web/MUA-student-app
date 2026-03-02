import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY as string;

// Expo Static Export (Node.js) doesn't have 'window'.
// AsyncStorage (web) and Supabase's auto-auth logic fail if they try to touch window/localStorage during SSR/SSG.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

const ssrStorage = {
    getItem: (key: string) => Promise.resolve(null),
    setItem: (key: string, value: string) => Promise.resolve(),
    removeItem: (key: string) => Promise.resolve(),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: isServer ? ssrStorage : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

if (!isServer) {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}
