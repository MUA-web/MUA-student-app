import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';

export default function SettingsScreen() {
    const router = useRouter();
    const [scheduledClasses, setScheduledClasses] = useState('40');
    const [attendanceThreshold, setAttendanceThreshold] = useState('75');
    const [includeStudentId, setIncludeStudentId] = useState(true);
    const [includeDept, setIncludeDept] = useState(true);
    const [autoExport, setAutoExport] = useState(false);

    const handleSave = () => {
        // Mock save logic
        router.back();
    };

    const SettingRow = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
        <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{label}</Text>
                {description && <Text style={styles.settingDesc}>{description}</Text>}
            </View>
            {children}
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerPageTitle}>Settings</Text>
                    <TouchableOpacity onPress={handleSave}>
                        <Text style={styles.saveHeaderBtn}>Save</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <ScrollView style={styles.contentBody} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.sectionTitle}>Attendance Export</Text>
                <Card style={styles.settingsCard}>
                    <SettingRow
                        label="Total Scheduled Classes"
                        description="Used to calculate percentage in Excel reports"
                    >
                        <TextInput
                            style={styles.numericInput}
                            value={scheduledClasses}
                            onChangeText={setScheduledClasses}
                            keyboardType="numeric"
                        />
                    </SettingRow>

                    <View style={styles.divider} />

                    <SettingRow
                        label="Attendance Threshold (%)"
                        description="Minimum required for exam eligibility"
                    >
                        <TextInput
                            style={styles.numericInput}
                            value={attendanceThreshold}
                            onChangeText={setAttendanceThreshold}
                            keyboardType="numeric"
                        />
                    </SettingRow>

                    <View style={styles.divider} />

                    <SettingRow label="Include Student ID" description="Add matriculation number column">
                        <Switch
                            value={includeStudentId}
                            onValueChange={setIncludeStudentId}
                            trackColor={{ false: '#E2E8F0', true: Colors.primary }}
                        />
                    </SettingRow>

                    <View style={styles.divider} />

                    <SettingRow label="Include Department" description="Add academic unit column">
                        <Switch
                            value={includeDept}
                            onValueChange={setIncludeDept}
                            trackColor={{ false: '#E2E8F0', true: Colors.primary }}
                        />
                    </SettingRow>
                </Card>

                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Automation</Text>
                <Card style={styles.settingsCard}>
                    <SettingRow
                        label="Daily Auto-Export"
                        description="Email report at end of day"
                    >
                        <Switch
                            value={autoExport}
                            onValueChange={setAutoExport}
                            trackColor={{ false: '#E2E8F0', true: Colors.primary }}
                        />
                    </SettingRow>
                </Card>

                <TouchableOpacity style={styles.resetBtn}>
                    <Text style={styles.resetText}>Restore Default Settings</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { backgroundColor: '#FFF' },
    customHeader: {
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
    headerPageTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
    saveHeaderBtn: { fontSize: 16, fontWeight: '700', color: Colors.primary, paddingHorizontal: 12 },
    contentBody: { flex: 1, padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    settingsCard: { padding: 8 },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    settingLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
    settingDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    numericInput: {
        width: 60,
        height: 40,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
    },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
    resetBtn: { marginTop: 40, alignItems: 'center', padding: 16 },
    resetText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
});
