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
    ActivityIndicator,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';

export default function LevelsScreen() {
    const router = useRouter();
    const [levels, setLevels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [levelLabel, setLevelLabel] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchLevels();
    }, []);

    const fetchLevels = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('levels')
                .select('*')
                .order('label', { ascending: true });

            if (error) throw error;
            setLevels(data || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to fetch levels');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (level?: any) => {
        if (level) {
            setEditingId(level.id);
            setLevelLabel(level.label);
        } else {
            setEditingId(null);
            setLevelLabel('');
        }
        setIsModalVisible(true);
    };

    const handleSave = async () => {
        if (!levelLabel.trim()) {
            Alert.alert('Error', 'Please enter a level label');
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('levels')
                    .update({ label: levelLabel })
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('levels')
                    .insert([{ label: levelLabel }]);
                if (error) throw error;
            }

            setIsModalVisible(false);
            fetchLevels();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save level');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this academic level?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('levels')
                                .delete()
                                .eq('id', id);
                            if (error) throw error;
                            fetchLevels();
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
                    <Text style={styles.headerPageTitle}>Levels Config</Text>
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
                        data={levels}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => (
                            <Card style={styles.levelCard}>
                                <View style={styles.levelInfo}>
                                    <View style={styles.iconBox}>
                                        <Ionicons name="layers" size={20} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.levelName}>{item.label}</Text>
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
                                <Ionicons name="layers-outline" size={60} color={Colors.inactive} />
                                <Text style={styles.emptyText}>No levels configured</Text>
                                <Text style={styles.emptySubtext}>Add levels like 100L, 200L, etc.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Level' : 'New Level'}</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Level Label</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 100L"
                            value={levelLabel}
                            onChangeText={setLevelLabel}
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Configuration</Text>
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
    levelCard: {
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    levelInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelName: { fontSize: 16, fontWeight: '700', color: Colors.text },
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
