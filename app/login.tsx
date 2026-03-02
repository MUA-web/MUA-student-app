import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { Colors } from '../constants/Colors';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = () => {
        setIsLoading(true);
        // Simulate login delay
        setTimeout(() => {
            setIsLoading(false);
            router.replace('/(tabs)');
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.card}>
                        <View style={styles.logoContainer}>
                            <Ionicons name="person-circle-outline" size={48} color={Colors.primary} />
                        </View>

                        <Text style={styles.brandTitle}>SmartFace</Text>

                        <Text style={styles.welcomeTitle}>Welcome Back</Text>
                        <Text style={styles.welcomeSubtitle}>
                            Please enter your credentials to access the attendance system.
                        </Text>

                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>School Email Address</Text>
                                <InputField
                                    icon="mail"
                                    placeholder="name@school.edu"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <InputField
                                    icon="lock-closed"
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    isPassword
                                />
                            </View>

                            <View style={styles.forgotPasswordContainer}>
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </View>

                            <PrimaryButton
                                title="Login"
                                onPress={handleLogin}
                                isLoading={isLoading}
                                style={styles.loginButton}
                            />

                            <View style={styles.helpContainer}>
                                <Ionicons name="help-circle" size={16} color={Colors.textSecondary} />
                                <Text style={styles.helpText}>Trouble logging in?</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <Text style={styles.footerLink}>Contact Admin</Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: 32,
        padding: 32,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
        alignItems: 'center',
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#EEF2FF',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    brandTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.primary,
        marginBottom: 32,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0A192F', // Very dark blue for strong contrast
        marginBottom: 12,
    },
    welcomeSubtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    formContainer: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155', // Slate grayish dark color
        marginBottom: 8,
        marginLeft: 4,
    },
    forgotPasswordContainer: {
        alignItems: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    loginButton: {
        marginBottom: 24,
    },
    helpContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    helpText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    footerLink: {
        fontSize: 15,
        color: Colors.primary,
        fontWeight: '700',
    },
});
