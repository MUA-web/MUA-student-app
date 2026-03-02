import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';

export default function CoursesScreen() {
    const router = useRouter();
    const [courses, setCourses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            // Join with departments and levels to get labels
            const { data, error } = await supabase
                .from('courses')
                .select(`
                    *,
                    departments (name),
                    levels (label)
                `)
                .order('code', { ascending: true });

            if (error) throw error;
            setCourses(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch courses');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to remove this course?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('courses')
                                .delete()
                                .eq('id', id);
                            if (error) throw error;
                            fetchCourses();
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to delete course');
                        }
                    }
                }
            ]
        );
    };
    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerPageTitle}>Courses</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <View style={styles.contentBody}>
                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={courses}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <Card style={styles.card}>
                                <View style={styles.content}>
                                    <View style={styles.topRow}>
                                        <Text style={styles.code}>{item.code}</Text>
                                        <View style={styles.deptBadge}>
                                            <Text style={styles.deptText}>{item.departments?.name || 'N/A'}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.name}>{item.name}</Text>
                                    <View style={styles.settingsRow}>
                                        <View style={styles.settingItem}>
                                            <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.settingText}>{item.session_day || 'No Day'}</Text>
                                        </View>
                                        <View style={styles.settingItem}>
                                            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.settingText}>{item.session_time || 'No Time'}</Text>
                                        </View>
                                        <View style={styles.settingItem}>
                                            <Ionicons name="stats-chart-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.settingText}>{item.total_sessions || 40} total</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.levelText}>{item.levels?.label || 'No Level'}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDelete(item.id)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                </TouchableOpacity>
                            </Card>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="book-outline" size={60} color={Colors.inactive} />
                                <Text style={styles.emptyText}>No courses found</Text>
                                <Text style={styles.emptySubtext}>Add courses using the button below</Text>
                            </View>
                        }
                    />
                )}
            </View>
            <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/(admin)/forms/course')}
            >
                <Ionicons name="book-outline" size={24} color="#FFF" />
                <Text style={styles.addBtnText}>Create New Course</Text>
            </TouchableOpacity>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { marginBottom: 15, padding: 20, flexDirection: 'row', alignItems: 'center' },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    code: { fontSize: 13, fontWeight: '800', color: Colors.primary },
    deptBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    deptText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
    name: { fontSize: 17, fontWeight: '700', color: Colors.text },
    settingsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    settingItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    settingText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
    levelText: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, fontWeight: '700', textTransform: 'uppercase' },
    deleteBtn: { padding: 8 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
    addBtn: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        height: 56,
        backgroundColor: Colors.secondary,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    addBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});
