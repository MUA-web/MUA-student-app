import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Animated, Easing, Dimensions, Image } from 'react-native';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../lib/supabase';

export default function StudentForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [selectedDept, setSelectedDept] = useState<any>(null);
    const [selectedLevel, setSelectedLevel] = useState<any>(null);
    const [studentNumber, setStudentNumber] = useState('');
    const [entryType, setEntryType] = useState('f'); // 'f' for fresh, 'd' for d.e
    const [imageUri, setImageUri] = useState<string | null>(null);

    const [availableDepts, setAvailableDepts] = useState<any[]>([]);
    const [availableLevels, setAvailableLevels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [deptModal, setDeptModal] = useState(false);
    const [levelModal, setLevelModal] = useState(false);
    const [isLoadingLevels, setIsLoadingLevels] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const cameraRef = React.useRef<any>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const scanAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name');
            if (error) throw error;
            setAvailableDepts(data || []);
        } catch (error) {
            console.error('Error fetching depts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLevels = async (deptId: string) => {
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
                    'This department has no levels configured. Seed default levels (Level 1-5)?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Seed Defaults', onPress: () => seedDefaultLevels(deptId) }
                    ]
                );
                setAvailableLevels([]);
            } else {
                setAvailableLevels(data);
            }
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
            fetchLevels(deptId);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to seed levels: ' + error.message);
        } finally {
            setIsLoadingLevels(false);
        }
    };

    const handleSelectDept = (dept: any) => {
        setSelectedDept(dept);
        setDeptModal(false);
        fetchLevels(dept.id);
        setSelectedLevel(null);
    };

    const handleSave = async () => {
        if (!name.trim() || !selectedDept || !selectedLevel || !studentNumber) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (!imageUri) {
            Alert.alert('Error', 'Please capture a student photo');
            return;
        }

        const fullId = `${selectedDept.prefix}${entryType}/${studentNumber}`;
        setIsSaving(true);
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('registrationNumber', fullId);
            formData.append('department', selectedDept.name);
            formData.append('level', selectedLevel.label);

            const filename = imageUri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image`;

            formData.append('image', { uri: imageUri, name: filename, type } as any);

            const response = await fetch(`${apiUrl}/register`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                Alert.alert('Success', data.message);
                router.back();
            } else {
                throw new Error(data.error || 'Failed to register student');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenCamera = async () => {
        if (!permission || !permission.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission required', 'Camera permission is needed');
                return;
            }
        }
        setShowCamera(true);
    };

    const takePicture = async () => {
        if (!cameraRef.current) return;
        const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
        });
        setImageUri(photo.uri);
        setShowCamera(false);
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Student</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity style={styles.photoSection} onPress={handleOpenCamera}>
                    <View style={styles.photoCircle}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.capturedImage} />
                        ) : (
                            <Ionicons name="camera" size={32} color={Colors.primary} />
                        )}
                    </View>
                    <Text style={styles.photoText}>{imageUri ? 'Change Photo' : 'Add Photo'}</Text>
                </TouchableOpacity>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter full name"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Admission Type</Text>
                    <View style={styles.typeToggleContainer}>
                        <TouchableOpacity
                            style={[styles.typeToggle, entryType === 'f' && styles.typeToggleActive]}
                            onPress={() => setEntryType('f')}
                        >
                            <Text style={[styles.typeToggleText, entryType === 'f' && styles.typeToggleTextActive]}>Fresh (f)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeToggle, entryType === 'd' && styles.typeToggleActive]}
                            onPress={() => setEntryType('d')}
                        >
                            <Text style={[styles.typeToggleText, entryType === 'd' && styles.typeToggleTextActive]}>D.E (d)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Student ID Number</Text>
                    <View style={styles.idInputWrapper}>
                        <View style={styles.prefixBadge}>
                            <Text style={styles.prefixText}>{selectedDept?.prefix || '.../'}{entryType}/</Text>
                        </View>
                        <TextInput
                            style={styles.numericInput}
                            placeholder="e.g. 001"
                            value={studentNumber}
                            onChangeText={(text) => setStudentNumber(text.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                        />
                    </View>
                    <Text style={styles.previewId}>Full ID: {selectedDept?.prefix || '.../'}{entryType}/{studentNumber || 'XXX'}</Text>
                </View>

                <SelectField label="Department" value={selectedDept?.name || 'Select Department'} onPress={() => setDeptModal(true)} />
                <SelectField label="Level" value={selectedLevel?.label || 'Select Level'} onPress={() => setLevelModal(true)} isLoadingLevels={isLoadingLevels} />

                <TouchableOpacity
                    style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveBtnText}>Register Student</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <OptionModal
                visible={deptModal}
                title="Select Department"
                options={availableDepts.map(d => d.name)}
                onSelect={(name: string) => handleSelectDept(availableDepts.find(d => d.name === name))}
                onClose={() => setDeptModal(false)}
            />
            <OptionModal
                visible={levelModal}
                title="Select Level"
                options={availableLevels.map(l => l.label)}
                onSelect={(label: string) => setSelectedLevel(availableLevels.find(l => l.label === label))}
                onClose={() => setLevelModal(false)}
                seedDefaultLevels={seedDefaultLevels}
                selectedDeptId={selectedDept?.id}
            />

            {showCamera && (
                <View style={styles.cameraOverlay}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
                    <View style={styles.cameraHeader}>
                        <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.closeCamera}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.cameraFooter}>
                        <TouchableOpacity style={styles.shutter} onPress={takePicture}>
                            <View style={styles.shutterInner} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const SelectField = ({ label, value, onPress, isLoadingLevels }: { label: string, value: string, onPress: () => void, isLoadingLevels?: boolean }) => (
    <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.selectTrigger} onPress={onPress}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.selectValue, value.includes('Select') && { color: Colors.inactive }]}>{value}</Text>
                {label === 'Level' && isLoadingLevels && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 10 }} />}
            </View>
            <Ionicons name="chevron-down" size={20} color={Colors.primary} />
        </TouchableOpacity>
    </View>
);

const OptionModal = ({ visible, title, options, onSelect, onClose, seedDefaultLevels, selectedDeptId }: any) => (
    <Modal visible={visible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={onClose}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{title}</Text>
                <ScrollView>
                    {options.length > 0 ? (
                        options.map((opt: string) => (
                            <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => { onSelect(opt); onClose(); }}>
                                <Text style={styles.modalOptionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyModalState}>
                            <Text style={styles.emptyModalText}>No options found.</Text>
                            {title === 'Select Level' && (
                                <TouchableOpacity style={styles.seedBtn} onPress={() => { onClose(); seedDefaultLevels(selectedDeptId); }}>
                                    <Text style={styles.seedBtnText}>Seed Default Levels</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        </Pressable>
    </Modal>
);

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
    scrollContent: { padding: 24 },
    photoSection: { alignItems: 'center', marginBottom: 32 },
    photoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderWidth: 2,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        overflow: 'hidden'
    },
    capturedImage: {
        width: '100%',
        height: '100%',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 1000,
    },
    cameraHeader: {
        position: 'absolute',
        top: 40,
        left: 20,
    },
    closeCamera: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraFooter: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    shutter: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 4,
        borderColor: '#FFF',
        padding: 4,
    },
    shutterInner: {
        flex: 1,
        borderRadius: 30,
        backgroundColor: '#FFF',
    },
    photoText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
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
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        maxHeight: '80%',
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 24 },
    modalOption: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalOptionText: { fontSize: 16, fontWeight: '600', color: Colors.text },
    typeToggleContainer: { flexDirection: 'row', gap: 12 },
    typeToggle: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    typeToggleActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    typeToggleText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    typeToggleTextActive: { color: '#FFF' },
    idInputWrapper: {
        flexDirection: 'row',
        height: 56,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    prefixBadge: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
    },
    prefixText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
    numericInput: {
        flex: 1,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
    },
    previewId: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary,
        marginTop: 8,
        marginLeft: 4,
    },
    emptyModalState: { paddingVertical: 20, alignItems: 'center' },
    emptyModalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
    seedBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary + '15', borderRadius: 10 },
    seedBtnText: { color: Colors.primary, fontWeight: '700' },
});
