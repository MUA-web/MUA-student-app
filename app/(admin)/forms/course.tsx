import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CourseForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [selectedDept, setSelectedDept] = useState<any>(null);
    const [selectedLevel, setSelectedLevel] = useState<any>(null);
    const [totalSessions, setTotalSessions] = useState('40');
    const [sessionDay, setSessionDay] = useState('');
    const [sessionTime, setSessionTime] = useState('');

    const [depts, setDepts] = useState<any[]>([]);
    const [levels, setLevels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [deptModal, setDeptModal] = useState(false);
    const [levelModal, setLevelModal] = useState(false);
    const [dayModal, setDayModal] = useState(false);
    const [isLoadingLevels, setIsLoadingLevels] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const { data: deptsData, error: deptsError } = await supabase
                .from('departments')
                .select('*')
                .order('name');

            if (deptsError) throw deptsError;
            setDepts(deptsData || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load options');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLevelsForDept = async (deptId: string) => {
        setIsLoadingLevels(true);
        try {
            const { data, error } = await supabase
                .from('levels')
                .select('*')
                .eq('department_id', deptId)
                .order('label');

            if (error) throw error;

            if (!data || data.length === 0) {
                Alert.alert(
                    'No Levels Found',
                    'This department has no levels configured. Would you like to seed default levels (Level 1-5)?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Seed Defaults', onPress: () => seedDefaultLevels(deptId) }
                    ]
                );
                setLevels([]);
            } else {
                setLevels(data);
            }
            setSelectedLevel(null);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to fetch levels: ' + error.message);
        } finally {
            setIsLoadingLevels(false);
        }
    };

    const seedDefaultLevels = async (deptId: string) => {
        setIsLoadingLevels(true);
        try {
            const defaults = [
                { department_id: deptId, label: 'Level 1' },
                { department_id: deptId, label: 'Level 2' },
                { department_id: deptId, label: 'Level 3' },
                { department_id: deptId, label: 'Level 4' },
                { department_id: deptId, label: 'Level 5' },
            ];
            const { error } = await supabase.from('levels').insert(defaults);
            if (error) throw error;

            fetchLevelsForDept(deptId);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to seed levels: ' + error.message);
        } finally {
            setIsLoadingLevels(false);
        }
    };

    const handleSelectDept = (dept: any) => {
        setSelectedDept(dept);
        setDeptModal(false);
        fetchLevelsForDept(dept.id);
    };

    const handleSave = async () => {
        if (!name.trim() || !code.trim() || !selectedDept) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('courses')
                .insert([{
                    name,
                    code: code.toUpperCase(),
                    department_id: selectedDept.id,
                    level_id: selectedLevel?.id || null,
                    total_sessions: parseInt(totalSessions) || 40,
                    session_day: sessionDay,
                    session_time: sessionTime
                }]);

            if (error) throw error;
            Alert.alert('Success', 'Course created successfully');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save course');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Course</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Course Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Software Engineering"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Course Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. CSC412"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Offering Department</Text>
                    <TouchableOpacity style={styles.selectTrigger} onPress={() => setDeptModal(true)}>
                        <Text style={[styles.selectValue, !selectedDept && { color: Colors.inactive }]}>
                            {selectedDept ? selectedDept.name : 'Select Department'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Level (Optional)</Text>
                    <TouchableOpacity
                        style={[styles.selectTrigger, !selectedDept && styles.disabledTrigger]}
                        onPress={() => selectedDept && setLevelModal(true)}
                        disabled={!selectedDept || isLoadingLevels}
                    >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.selectValue, !selectedLevel && { color: Colors.inactive }]}>
                                {selectedLevel ? selectedLevel.label : 'Select Level'}
                            </Text>
                            {isLoadingLevels && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 10 }} />}
                        </View>
                        <Ionicons name="chevron-down" size={20} color={selectedDept ? Colors.primary : Colors.inactive} />
                    </TouchableOpacity>
                    {!selectedDept && <Text style={styles.helperText}>Select a department first</Text>}
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Attendance Configuration</Text>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Total Sessions per Semester</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 40"
                        value={totalSessions}
                        onChangeText={setTotalSessions}
                        keyboardType="number-pad"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 12 }]}>
                        <Text style={styles.label}>Class Day</Text>
                        <TouchableOpacity style={styles.selectTrigger} onPress={() => setDayModal(true)}>
                            <Text style={[styles.selectValue, !sessionDay && { color: Colors.inactive }]}>
                                {sessionDay || 'Select Day'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Class Time</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 10:00 AM"
                            value={sessionTime}
                            onChangeText={setSessionTime}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, (!name || !code || !selectedDept || isSaving) && styles.disabledBtn]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save Course</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Department Modal */}
            <Modal visible={deptModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setDeptModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Department</Text>
                        <ScrollView>
                            {depts.map(opt => (
                                <TouchableOpacity key={opt.id} style={styles.modalOption} onPress={() => handleSelectDept(opt)}>
                                    <Text style={styles.modalOptionText}>{opt.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Level Modal */}
            <Modal visible={levelModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setLevelModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Level</Text>
                        <ScrollView>
                            {levels.length > 0 ? (
                                levels.map(opt => (
                                    <TouchableOpacity key={opt.id} style={styles.modalOption} onPress={() => { setSelectedLevel(opt); setLevelModal(false); }}>
                                        <Text style={styles.modalOptionText}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={styles.emptyModalState}>
                                    <Text style={styles.emptyModalText}>No levels found for this department.</Text>
                                    <TouchableOpacity style={styles.seedBtn} onPress={() => { setLevelModal(false); seedDefaultLevels(selectedDept.id); }}>
                                        <Text style={styles.seedBtnText}>Seed Default Levels</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Day Modal */}
            <Modal visible={dayModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setDayModal(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Class Day</Text>
                        <ScrollView>
                            {DAYS.map(day => (
                                <TouchableOpacity key={day} style={styles.modalOption} onPress={() => { setSessionDay(day); setDayModal(false); }}>
                                    <Text style={styles.modalOptionText}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
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
    inputContainer: { marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    sectionHeader: { marginTop: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
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
    disabledTrigger: {
        backgroundColor: '#F8FAFC',
        borderColor: '#F1F5F9',
    },
    helperText: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 4,
        marginLeft: 4,
    },
    selectTrigger: {
        height: 56,
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    selectValue: { fontSize: 16, fontWeight: '500', color: Colors.text },
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
    disabledBtn: {
        opacity: 0.6,
        backgroundColor: Colors.inactive,
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        maxHeight: '70%',
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 24 },
    modalOption: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalOptionText: { fontSize: 16, fontWeight: '600', color: Colors.text },
    emptyModalState: { paddingVertical: 20, alignItems: 'center' },
    emptyModalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
    seedBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary + '15', borderRadius: 10 },
    seedBtnText: { color: Colors.primary, fontWeight: '700' },
});
