import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../constants/Colors';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'glass';
}

export default function Card({ children, style, variant = 'default' }: CardProps) {
    return (
        <View style={[
            styles.card,
            variant === 'glass' && styles.glassCard,
            style
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 6,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)', // Note: backdropFilter doesn't work in RN natively without extra libs, but we style for it
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    }
});
