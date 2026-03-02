import { Ionicons } from '@expo/vector-icons';
import { Tabs as ExpoTabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';

export default function TabLayout() {
    return (
        <ExpoTabs
            initialRouteName="index"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarStyle: {
                    display: 'flex',
                    borderTopWidth: 1,
                    borderTopColor: '#F1F5F9',
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 10,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '700',
                    marginTop: 4,
                },
            }}
        >
            <ExpoTabs.Screen
                name="index"
                options={{
                    headerShown: false,
                    title: 'Dashboard',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="home" size={24} color={color} />
                    ),
                }}
            />

            <ExpoTabs.Screen
                name="register"
                options={{
                    title: 'Attendance',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="finger-print" size={24} color={color} />
                    ),
                }}
            />

            <ExpoTabs.Screen
                name="classes"
                options={{
                    title: 'Assign Course',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="book" size={24} color={color} />
                    ),
                }}
            />

            <ExpoTabs.Screen
                name="history"
                options={{
                    href: null,
                }}
            />
            <ExpoTabs.Screen
                name="profile"
                options={{
                    href: null,
                }}
            />
            <ExpoTabs.Screen
                name="notifications"
                options={{
                    href: null,
                }}
            />
        </ExpoTabs>
    );
}

const styles = StyleSheet.create({
    fabContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        top: -12, // Float out of tab bar
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
