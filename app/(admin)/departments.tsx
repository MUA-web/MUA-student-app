import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';

export default function DepartmentsScreen() {
    const router = useRouter();
    const [departments, setDepartments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [prefix, setPrefix] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setDepartments(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch departments');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (dept?: any) => {
        if (dept) {
            setEditingId(dept.id);
            setName(dept.name);
            setPrefix(dept.prefix);
        } else {
            setEditingId(null);
            setName('');
            setPrefix('');
        }
        setIsModalVisible(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !prefix.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('departments')
                    .update({ name, prefix })
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('departments')
                    .insert([{ name, prefix }]);
                if (error) throw error;
            }

            setIsModalVisible(false);
            fetchDepartments();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save department');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this department?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('departments')
                                .delete()
                                .eq('id', id);
                            if (error) throw error;
                            fetchDepartments();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to delete');
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
                    <Text style={styles.headerPageTitle}>Departments</Text>
                    <TouchableOpacity onPress={() => handleOpenModal()} style={styles.addBtn}>
                        <Ionicons name="add" size={28} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <View style={styles.contentBody}>
                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={departments}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => (
                            <Card style={styles.deptCard}>
                                <View style={styles.deptInfo}>
                                    <Text style={styles.deptName}>{item.name}</Text>
                                    <Text style={styles.deptPrefix}>Prefix: {item.prefix}</Text>
                                </View>
                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.actionIcon}
                                        onPress={() => handleOpenModal(item)}
                                    >
                                        <Ionicons name="create-outline" size={20} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionIcon}
                                        onPress={() => handleDelete(item.id)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="business-outline" size={60} color={Colors.inactive} />
                                <Text style={styles.emptyText}>No departments found</Text>
                                <Text style={styles.emptySubtext}>Add your first department using the + button</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Department' : 'New Department'}</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Department Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Computer Science"
                            value={name}
                            onChangeText={setName}
                        />

                        <Text style={styles.inputLabel}>Registration ID Prefix</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. SCE/PT/BSCS/23/"
                            value={prefix}
                            onChangeText={setPrefix}
                        />

                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Department</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { backgroundColor: '#FFF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    addBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerPageTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
    contentBody: { flex: 1, padding: 20 },
    list: { paddingBottom: 20 },
    deptCard: {
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    deptInfo: { flex: 1 },
    deptName: { fontSize: 16, fontWeight: '700', color: Colors.text },
    deptPrefix: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
    actions: { flexDirection: 'row', gap: 12 },
    actionIcon: { padding: 4 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 50
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
    inputLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
    input: {
        height: 56,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        fontSize: 16,
        color: Colors.text,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 20
    },
    saveBtn: {
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
