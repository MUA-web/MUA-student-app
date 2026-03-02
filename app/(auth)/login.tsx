import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Alert,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withSequence
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const PASSCODE_LENGTH = 6;
const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [passcode, setPasscode] = useState('');
    const [savedEmail, setSavedEmail] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'email' | 'passcode'>('email');

    useEffect(() => {
        checkSavedEmail();
    }, []);

    const checkSavedEmail = async () => {
        try {
            const storedEmail = await AsyncStorage.getItem('saved_user_email');
            if (storedEmail) {
                setSavedEmail(storedEmail);
                setEmail(storedEmail);
                setStep('passcode');
            }
        } catch (error) {
            console.error('Error checking saved email:', error);
        }
    };

    const handleEmailNext = () => {
        if (!email || !email.includes('@')) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Invalid Email', 'Please enter a valid university email address');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setStep('passcode');
    };

    const handleLogin = async (finalPasscode?: string) => {
        const passwordToUse = finalPasscode || passcode;
        if (passwordToUse.length < 6) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: passwordToUse,
            });

            if (error) throw error;

            await AsyncStorage.setItem('saved_user_email', email);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)');
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Login Error', error.message || 'Invalid passcode or email');
            setPasscode('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (num: string) => {
        if (passcode.length < PASSCODE_LENGTH) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const newPasscode = passcode + num;
            setPasscode(newPasscode);
            if (newPasscode.length === PASSCODE_LENGTH) {
                handleLogin(newPasscode);
            }
        }
    };

    const handleBackspace = () => {
        if (passcode.length > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPasscode(passcode.slice(0, -1));
        }
    };

    const resetSavedEmail = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await AsyncStorage.removeItem('saved_user_email');
        setSavedEmail(null);
        setPasscode('');
        setStep('email');
    };

    const maskEmail = (emailStr: string) => {
        const [user, domain] = emailStr.split('@');
        return `${user.slice(0, 1)}***@${domain}`;
    };

    const renderEmailStep = () => (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.contentCenter}>
            <View style={styles.header}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Enter your email to sign in</Text>
            </View>

            <View style={styles.inputGroup}>
                <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                        placeholder="your@email.com"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>
            </View>

            <TouchableOpacity style={styles.primaryBtnBlue} onPress={handleEmailNext}>
                <Text style={styles.btnText}>Continue</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                    <Text style={[styles.linkText, { color: BLUE_PRIMARY }]}>Sign Up</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderPasscodeStep = () => (
        <Animated.View entering={FadeInUp.duration(600)} style={styles.content}>
            <View style={styles.topRow}>
                <TouchableOpacity onPress={resetSavedEmail} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={26} color={BLUE_PRIMARY} />
                </TouchableOpacity>
                <View style={styles.userInfoBadge}>
                    <Ionicons name="call-outline" size={14} color={BLUE_PRIMARY} />
                    <Text style={styles.badgeText}>{maskEmail(email)}</Text>
                </View>
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>Enter your passcode</Text>
                <Text style={styles.subtitle}>Enter your 6 digit passcode</Text>
            </View>

            <View style={styles.passcodeContainer}>
                {[...Array(PASSCODE_LENGTH)].map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.passcodeBox,
                            passcode.length > i && styles.passcodeBoxFilled,
                            passcode.length === i && styles.passcodeBoxActive
                        ]}
                    >
                        {passcode.length > i && <Text style={styles.passcodeText}>*</Text>}
                    </View>
                ))}
            </View>

            {isLoading && <ActivityIndicator size="small" color={BLUE_PRIMARY} style={{ marginBottom: 20 }} />}

            <View style={styles.keypad}>
                {[
                    ['1', '2', '3'],
                    ['4', '5', '6'],
                    ['7', '8', '9'],
                ].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.keypadRow}>
                        {row.map((key) => (
                            <TouchableOpacity
                                key={key}
                                style={styles.keyBtn}
                                onPress={() => handleKeyPress(key)}
                            >
                                <Text style={styles.keyText}>{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
                {/* Bottom row: back · 0 · go */}
                <View style={styles.keypadRow}>
                    <TouchableOpacity style={styles.keyBtnGhost} onPress={handleBackspace}>
                        <Ionicons name="backspace-outline" size={26} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.keyBtn} onPress={() => handleKeyPress('0')}>
                        <Text style={styles.keyText}>0</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.keyBtnPrimary} onPress={() => handleLogin()}>
                        <Ionicons name="arrow-forward" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={styles.forgotPasscode}
                onPress={() => Alert.alert('Passcode Reset', 'Password reset instructions have been sent to your email.')}
            >
                <Text style={[styles.forgotText, { color: BLUE_PRIMARY }]}>Forgot passcode?</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {step === 'email' ? renderEmailStep() : renderPasscodeStep()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
    contentCenter: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 60 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    backBtn: { width: 44, height: 44, justifyContent: 'center' },
    userInfoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE_LIGHT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
    badgeText: { color: BLUE_PRIMARY, fontWeight: '700', fontSize: 13 },
    header: { alignItems: 'center', marginBottom: 40, marginTop: 10 },
    title: { fontSize: 26, fontWeight: '800', color: BLUE_PRIMARY, marginBottom: 8, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: '#64748B', fontWeight: '500', textAlign: 'center' },
    inputGroup: { marginBottom: 24 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 60,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1E293B' },
    primaryBtnBlue: { height: 60, borderRadius: 16, backgroundColor: BLUE_PRIMARY, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
    footerText: { color: '#64748B', fontSize: 15, fontWeight: '500' },
    linkText: { fontSize: 15, fontWeight: '700' },
    passcodeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 50,
    },
    passcodeBox: {
        width: (width - 100) / 6,
        height: 64,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    passcodeBoxFilled: {
        borderColor: BLUE_PRIMARY,
    },
    passcodeBoxActive: {
        borderColor: BLUE_PRIMARY,
        backgroundColor: '#FFFFFF',
    },
    passcodeText: {
        fontSize: 32,
        fontWeight: '700',
        color: BLUE_PRIMARY,
        marginTop: 12, // Align asterisk visually
    },
    keypad: { width: '100%', gap: 12 },
    keypadRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    keyBtn: {
        width: (width - 96) / 3,
        height: (width - 96) / 3,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBtnGhost: {
        width: (width - 96) / 3,
        height: (width - 96) / 3,
        borderRadius: 20,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBtnPrimary: {
        width: (width - 96) / 3,
        height: (width - 96) / 3,
        borderRadius: 20,
        backgroundColor: BLUE_PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyText: { fontSize: 28, fontWeight: '600', color: '#1E293B' },
    forgotPasscode: { marginTop: 28, alignSelf: 'center' },
    forgotText: { fontSize: 15, fontWeight: '700' },
});
