import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Text, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
    const router = useRouter();
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.8);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            }),
        ]).start();

        const checkFlow = async () => {
            const signupComplete = await AsyncStorage.getItem('HAS_SEEN_ONBOARDING');
            const { data: { session } } = await supabase.auth.getSession();

            // Artificial delay for splash screen branding
            setTimeout(() => {
                if (signupComplete !== 'true') {
                    router.replace('/onboarding');
                } else if (session) {
                    router.replace('/(tabs)');
                } else {
                    router.replace('/(auth)/login');
                }
            }, 2000);
        };

        checkFlow();

        return () => { };
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#1E40AF', '#2563EB', '#3B82F6']}
                style={styles.gradient}
            >
                <Animated.View style={[
                    styles.logoContainer,
                    { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={styles.logoBackground}>
                        <Ionicons name="shield-checkmark" size={80} color="#FFF" />
                    </View>
                    <Text style={styles.title}>MBSARARI</Text>
                    <Text style={styles.subtitle}>Smart Attendance System</Text>
                </Animated.View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Secure • Reliable • Efficient</Text>
                    <View style={styles.loaderBarOuter}>
                        <Animated.View style={[styles.loaderBarInner, { width: '60%' }]} />
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    logoContainer: { alignItems: 'center' },
    logoBackground: {
        width: 150,
        height: 150,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 5,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 20,
    },
    loaderBarOuter: {
        width: 100,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    loaderBarInner: {
        height: '100%',
        backgroundColor: '#FFF',
        borderRadius: 2,
    },
});
