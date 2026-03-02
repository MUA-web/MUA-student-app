import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

interface InputFieldProps extends TextInputProps {
    icon?: keyof typeof Ionicons.glyphMap;
    isPassword?: boolean;
}

export default function InputField({ icon, isPassword, style, ...props }: InputFieldProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(!isPassword);

    return (
        <View style={[styles.container, isFocused && styles.containerFocused, style]}>
            {icon && (
                <Ionicons
                    name={icon}
                    size={20}
                    color={isFocused ? Colors.primary : Colors.textSecondary}
                    style={styles.icon}
                />
            )}

            <TextInput
                style={styles.input}
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={isPassword && !showPassword}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                {...props}
            />

            {isPassword && (
                <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIconContainer}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name={showPassword ? "eye" : "eye-off"}
                        size={20}
                        color={Colors.textSecondary}
                    />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 24, // High border radius as seen in design
        paddingHorizontal: 16,
        height: 56,
        width: '100%',
    },
    containerFocused: {
        borderColor: Colors.primary,
        backgroundColor: Colors.card,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        color: Colors.text,
        fontSize: 16,
    },
    eyeIconContainer: {
        marginLeft: 8,
    },
});
