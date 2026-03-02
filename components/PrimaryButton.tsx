import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface PrimaryButtonProps {
    title: string;
    onPress: () => void;
    isLoading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: keyof typeof Ionicons.glyphMap;
    variant?: 'primary' | 'secondary' | 'outline';
}

export default function PrimaryButton({
    title,
    onPress,
    isLoading = false,
    style,
    textStyle,
    icon,
    variant = 'primary',
}: PrimaryButtonProps) {
    const getBackgroundStyle = () => {
        switch (variant) {
            case 'secondary':
                return styles.secondaryBackground;
            case 'outline':
                return styles.outlineBackground;
            default:
                return styles.primaryBackground;
        }
    };

    const getTextStyle = () => {
        switch (variant) {
            case 'outline':
                return styles.outlineText;
            default:
                return styles.primaryText;
        }
    };

    return (
        <TouchableOpacity
            style={[styles.button, getBackgroundStyle(), style]}
            onPress={onPress}
            disabled={isLoading}
            activeOpacity={0.8}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.card} />
            ) : (
                <>
                    {icon && <Ionicons name={icon} size={20} color={getTextStyle().color} style={styles.icon} />}
                    <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        width: '100%',
    },
    primaryBackground: {
        backgroundColor: Colors.primary,
    },
    secondaryBackground: {
        backgroundColor: Colors.secondary,
    },
    outlineBackground: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryText: {
        color: Colors.card, // White text
    },
    outlineText: {
        color: Colors.textSecondary,
    },
    icon: {
        marginRight: 8,
    },
});
