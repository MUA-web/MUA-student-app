import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput, Modal, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';

import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function AttendanceLogScreen() {
    const router = useRouter();
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedLevel, setSelectedLevel] = useState('All');
    const [selectedCourse, setSelectedCourse] = useState('All');
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [availableDepts, setAvailableDepts] = useState<string[]>(['All']);
    const [availableLevels, setAvailableLevels] = useState<string[]>(['All']);
    const [availableCourses, setAvailableCourses] = useState<string[]>(['All']);

    useEffect(() => {
        fetchLogs();
        fetchFilters();
    }, []);

    const fetchFilters = async () => {
        try {
            const { data: dData } = await supabase.from('departments').select('name').order('name');
            const { data: lData } = await supabase.from('levels').select('label').order('label');
            const { data: cData } = await supabase.from('courses').select('code').order('code');

            if (dData) setAvailableDepts(['All', ...dData.map(d => d.name)]);
            if (lData) setAvailableLevels(['All', ...Array.from(new Set(lData.map(l => l.label)))]);
            if (cData) setAvailableCourses(['All', ...cData.map(c => c.code)]);
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            const response = await fetch(`${API_URL}/attendance`);
            const data = await response.json();
            if (data.records) {
                setLogs(data.records);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            Alert.alert('Error', 'Failed to fetch logs from server');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesDept = selectedDept === 'All' || log.department === selectedDept;
        const matchesLevel = selectedLevel === 'All' || log.level === selectedLevel;
        const matchesCourse = selectedCourse === 'All' || log.course_code === selectedCourse;
        return matchesDept && matchesLevel && matchesCourse;
    }).sort((a, b) => {
        // Default sort by time, but group by selected filters if needed? 
        // User asked for "sorting the first one dept the second level the thid course"
        // I will implement a hierarchical sort based on their preference: Dept > Level > Course
        const deptComp = (a.department || '').localeCompare(b.department || '');
        if (deptComp !== 0) return deptComp;

        const levelComp = (a.level || '').localeCompare(b.level || '');
        if (levelComp !== 0) return levelComp;

        const courseComp = (a.course_code || '').localeCompare(b.course_code || '');
        if (courseComp !== 0) return courseComp;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const Dropdown = ({ label, value, options, onSelect }: { label: string, value: string, options: string[], onSelect: (val: string) => void }) => {
        const [visible, setVisible] = useState(false);
        return (
            <View style={{ flex: 1 }}>
                <Text style={styles.dropdownLabel}>{label}</Text>
                <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setVisible(true)}>
                    <Text style={styles.dropdownValue}>{value}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
                    <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select {label}</Text>
                            <ScrollView>
                                {options.map(opt => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={[styles.modalOption, value === opt && styles.modalOptionActive]}
                                        onPress={() => { onSelect(opt); setVisible(false); }}
                                    >
                                        <Text style={[styles.modalOptionText, value === opt && styles.modalOptionTextActive]}>{opt}</Text>
                                        {value === opt && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </Pressable>
                </Modal>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <Card style={styles.logCard}>
            <View style={styles.logMain}>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <View style={styles.logMetaRow}>
                        <Text style={styles.logDate}>{item.date || 'Today'} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        {item.course_code && (
                            <View style={styles.courseBadgeSmall}>
                                <Text style={styles.courseBadgeTextSmall}>{item.course_code}</Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: Colors.successSurface }
                ]}>
                    <Text style={[
                        styles.statusText,
                        { color: Colors.success }
                    ]}>
                        Present
                    </Text>
                </View>
            </View>
        </Card>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerPageTitle}>Attendance Log</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <View style={styles.contentBody}>
                <View style={styles.verticalFilterContainer}>
                    <View style={styles.filterField}>
                        <Dropdown label="Department" value={selectedDept} options={availableDepts} onSelect={setSelectedDept} />
                    </View>
                    <View style={styles.filterField}>
                        <Dropdown label="Level" value={selectedLevel} options={availableLevels} onSelect={setSelectedLevel} />
                    </View>
                    <View style={styles.filterField}>
                        <Dropdown label="Course" value={selectedCourse} options={availableCourses} onSelect={setSelectedCourse} />
                    </View>
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredLogs}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <TouchableOpacity style={styles.exportBtn}>
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                    <Text style={styles.exportText}>Export Report</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
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
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerPageTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.text,
    },
    contentBody: { flex: 1, padding: 20 },
    verticalFilterContainer: {
        marginBottom: 24,
        gap: 16,
    },
    filterField: {
        flexDirection: 'row',
    },
    listContent: {
        paddingBottom: 100,
    },
    dropdownLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 6,
        marginLeft: 4,
    },
    dropdownTrigger: {
        height: 48,
        backgroundColor: '#FFF',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    dropdownValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        maxHeight: '60%',
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 20,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    modalOptionActive: {
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderRadius: 12,
        paddingHorizontal: 10,
    },
    modalOptionText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    modalOptionTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    logCard: {
        marginBottom: 12,
        padding: 16,
    },
    logMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userInfo: {
        gap: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    logDate: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    logMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    courseBadgeSmall: {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    courseBadgeTextSmall: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.primary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
    },
    exportBtn: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    exportText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
