import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

const BLUE_PRIMARY = '#2563EB';

interface HeaderProps {
    userName: string;
    date: string;
    avatarUrl?: string;
    onNotificationPress?: () => void;
    light?: boolean;
    unreadCount?: number;
}

export default function Header({ userName, date, avatarUrl, onNotificationPress, light, unreadCount = 0 }: HeaderProps) {
    const textColor = light ? '#FFF' : '#0A192F';
    const subTextColor = light ? 'rgba(255,255,255,0.7)' : Colors.textSecondary;

    return (
        <View style={styles.container}>
            <View style={styles.leftSection}>
                <View style={[styles.avatarContainer, light && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <Ionicons name="person" size={24} color={light ? '#FFF' : Colors.textSecondary} />
                    )}
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.greeting, { color: textColor }]}>Hello, {userName} 👋</Text>
                    <Text style={[styles.date, { color: subTextColor }]}>{date}</Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={onNotificationPress}
                style={[
                    styles.notificationBtn,
                    light && { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' }
                ]}
            >
                <Ionicons name="notifications" size={22} color={light ? '#FFF' : Colors.text} />
                {unreadCount > 0 && (
                    <View style={[styles.badge, light && { borderColor: BLUE_PRIMARY }]} />
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        flex: 1,
        paddingRight: 10,
    },
    greeting: {
        fontSize: 18,
        fontWeight: '800',
    },
    date: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    notificationBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    badge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F87171', // soft red
        borderWidth: 2,
        borderColor: Colors.surface,
    },
});
