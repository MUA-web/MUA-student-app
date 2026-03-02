import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput, Modal, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';

import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function StudentsScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedLevel, setSelectedLevel] = useState('All');
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [availableDepts, setAvailableDepts] = useState<string[]>(['All']);
    const [availableLevels, setAvailableLevels] = useState<string[]>(['All']);

    useEffect(() => {
        fetchStudents();
        fetchFilters();
    }, []);

    const fetchFilters = async () => {
        try {
            const { data: dData } = await supabase.from('departments').select('name').order('name');
            const { data: lData } = await supabase.from('levels').select('label').order('label');

            if (dData) setAvailableDepts(['All', ...dData.map(d => d.name)]);
            if (lData) setAvailableLevels(['All', ...Array.from(new Set(lData.map(l => l.label)))]);
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await fetch(`${API_URL}/users`);
            const data = await response.json();
            if (data.users) {
                setStudents(data.users);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            Alert.alert('Error', 'Failed to fetch students from server');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteStudent = async (regNo: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove student with ID ${regNo}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${API_URL}/users/${encodeURIComponent(regNo)}`, {
                                method: 'DELETE'
                            });
                            const data = await response.json();
                            if (data.success) {
                                Alert.alert('Success', data.message);
                                fetchStudents();
                            } else {
                                throw new Error(data.error);
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete student');
                        }
                    }
                }
            ]
        );
    };

    const filteredStudents = students
        .filter(student => {
            const nameMatch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
            const regMatch = student.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSearch = nameMatch || regMatch;
            const matchesDept = selectedDept === 'All' || student.department === selectedDept;
            const matchesLevel = selectedLevel === 'All' || student.level === selectedLevel;
            return matchesSearch && matchesDept && matchesLevel;
        })
        .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber, undefined, { numeric: true }));

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

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerPageTitle}>Students</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <View style={styles.contentBody}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color={Colors.inactive} />
                    <TextInput
                        placeholder="Search name or ID..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View style={styles.filterBar}>
                    <Dropdown label="Dept" value={selectedDept} options={availableDepts} onSelect={setSelectedDept} />
                    <View style={{ width: 12 }} />
                    <Dropdown label="Level" value={selectedLevel} options={availableLevels} onSelect={setSelectedLevel} />
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredStudents}
                        keyExtractor={item => item.registrationNumber}
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => (
                            <Card style={styles.studentCard}>
                                <View style={styles.cardContent}>
                                    <View style={[styles.avatar, { backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Ionicons name="person" size={24} color={Colors.primary} />
                                    </View>
                                    <View style={styles.info}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name}>{item.name}</Text>
                                            <View style={styles.regBadge}>
                                                <Text style={styles.regText}>{item.registrationNumber}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.subInfo}>{item.department} • {item.level}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteStudent(item.registrationNumber)}>
                                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        )}
                    />
                )}
            </View>
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
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 20,
    },
    searchInput: { flex: 1, marginLeft: 10, fontWeight: '500' },
    list: { paddingBottom: 20 },
    filterBar: {
        flexDirection: 'row',
        marginBottom: 20,
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
    studentCard: { marginBottom: 12, padding: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: 12, marginRight: 15 },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: Colors.text },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    regBadge: {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    regText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
    subInfo: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
