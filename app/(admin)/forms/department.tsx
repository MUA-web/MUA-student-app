import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';

export default function DepartmentForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [prefix, setPrefix] = useState('');

    const handleSave = () => {
        router.back();
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Department</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Department Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Computer Science"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Department Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. CSC"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Admission Prefix</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. sce/pt/bscs/23/"
                        value={prefix}
                        onChangeText={setPrefix}
                        autoCapitalize="none"
                    />
                    <Text style={styles.helperText}>Suffix /f or /d will be added automatically during student registration.</Text>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>Create Department</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { backgroundColor: '#FFF' },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
    content: { flex: 1 },
    scrollContent: { padding: 24, paddingTop: 32 },
    inputContainer: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginLeft: 4 },
    input: {
        height: 56,
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '500',
        color: Colors.text,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    helperText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 6,
        marginLeft: 4,
        fontStyle: 'italic',
    },
    saveBtn: {
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
