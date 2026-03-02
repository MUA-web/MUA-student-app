import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import Animated, {
    FadeInDown,
    SlideInRight,
    SlideOutLeft,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    interpolate
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 600);
const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';
const SLATE_LIGHT = '#F8FAFC';

export default function RegisterScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);

    // Step 1: Info
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    // Step 2: Password
    const [password, setPassword] = useState('');

    // Step 3: Academic
    const [selectedDept, setSelectedDept] = useState<any>(null);
    const [selectedLevel, setSelectedLevel] = useState<any>(null);
    const [studentNumber, setStudentNumber] = useState('');
    const [entryType, setEntryType] = useState('f');

    const [availableDepts, setAvailableDepts] = useState<any[]>([]);
    const [availableLevels, setAvailableLevels] = useState<any[]>([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Selection Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'dept' | 'level' | 'entry' | 'year' | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    React.useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            setAvailableDepts(data || []);
        } catch (error) {
            console.error('Error fetching depts:', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const fetchLevels = async (deptId: string) => {
        try {
            const { data, error } = await supabase
                .from('levels')
                .select('*')
                .eq('department_id', deptId)
                .order('label', { ascending: true });
            if (error) throw error;
            setAvailableLevels(data || []);
        } catch (error) {
            console.error('Error fetching levels:', error);
        }
    };

    const handleNext = (finalPasscode?: string) => {
        const pToUse = finalPasscode || password;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (currentStep === 1) {
            if (!fullName || !email || !email.includes('@')) {
                Alert.alert('Required', 'Please enter your full name and a valid university email');
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (pToUse.length < 6) {
                Alert.alert('Passcode Short', 'Passcode must be 6 digits');
                return;
            }
            setCurrentStep(3);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (currentStep > 1) setCurrentStep(currentStep - 1);
        else router.back();
    };

    const handleRegister = async () => {
        if (!selectedDept || !selectedLevel || !studentNumber || !selectedYear) {
            Alert.alert('Required', 'Please complete all academic profile fields');
            return;
        }

        if (studentNumber.length !== 3) {
            Alert.alert('Invalid ID', 'Student number must be exactly 3 digits (e.g. 001)');
            return;
        }

        setIsLoading(true);
        const prefix = (selectedDept.prefix || '').toUpperCase();
        const type = entryType.toUpperCase();
        const year = selectedYear;
        const fullId = `${prefix}/${type}/${year}/${studentNumber}`;

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: 'student',
                        full_name: fullName,
                        reg_no: fullId,
                        department: selectedDept.name,
                        level: selectedLevel.label,
                        department_id: selectedDept.id,
                        level_id: selectedLevel.id,
                    }
                }
            });

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsSuccess(true);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };

    const ProgressIndicator = () => (
        <View style={styles.progressWrapper}>
            <View style={styles.progressCircle}>
                <Text style={styles.progressText}>{currentStep}<Text style={styles.progressTotal}>/3</Text></Text>
                <View style={[styles.progressRing, { borderRightColor: currentStep >= 2 ? BLUE_PRIMARY : '#E2E8F0', borderBottomColor: currentStep === 3 ? BLUE_PRIMARY : '#E2E8F0' }]} />
            </View>
        </View>
    );

    const ConfettiPiece = ({ index }: { index: number }) => {
        const translateY = useSharedValue(-20);
        const translateX = useSharedValue(Math.random() * width);
        const rotate = useSharedValue(0);
        const opacity = useSharedValue(1);

        const colors = [BLUE_PRIMARY, '#22C55E', '#FBDF4B', '#EC4899', '#8B5CF6'];
        const color = colors[index % colors.length];

        useEffect(() => {
            const duration = 2000 + Math.random() * 3000;
            const delay = Math.random() * 2000;

            translateY.value = withDelay(delay, withTiming(Dimensions.get('window').height, { duration }));
            translateX.value = withDelay(delay, withTiming(translateX.value + (Math.random() - 0.5) * 200, { duration }));
            rotate.value = withDelay(delay, withTiming(720 + Math.random() * 720, { duration }));
            opacity.value = withDelay(delay + duration - 500, withTiming(0, { duration: 500 }));
        }, []);

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [
                { translateY: translateY.value },
                { translateX: translateX.value },
                { rotate: `${rotate.value}deg` }
            ],
            opacity: opacity.value,
        }));

        return (
            <Animated.View
                style={[
                    styles.confettiPiece,
                    animatedStyle,
                    { backgroundColor: color, width: 8 + Math.random() * 8, height: 8 + Math.random() * 8 }
                ]}
            />
        );
    };

    const ConfettiCannon = () => (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {[...Array(50)].map((_, i) => (
                <ConfettiPiece key={i} index={i} />
            ))}
        </View>
    );

    const SuccessView = () => (
        <Animated.View entering={FadeInDown} style={styles.successContainer}>
            <ConfettiCannon />
            <View style={styles.successContent}>
                <View style={styles.checkOutline3}>
                    <View style={styles.checkOutline2}>
                        <View style={styles.checkOutline1}>
                            <View style={styles.checkCircle}>
                                <Ionicons name="checkmark" size={42} color="#FFF" />
                            </View>
                        </View>
                    </View>
                </View>

                <Text style={styles.successTitle}>Registration{"\n"}Successful</Text>
                <Text style={styles.successSubtitle}>Your academic profile has been created. You can now log in to complete your face enrollment.</Text>
            </View>

            <TouchableOpacity
                style={styles.successBtn}
                onPress={() => router.replace('/(auth)/login')}
            >
                <Text style={styles.successBtnText}>Continue To Login</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const SelectionModal = () => {
        const data = modalType === 'dept'
            ? availableDepts
            : modalType === 'level'
                ? availableLevels
                : modalType === 'entry'
                    ? [{ id: 'f', label: 'Fresh' }, { id: 'd', label: 'Direct Entry (D.E)' }]
                    : (() => {
                        const startYear = 2023;
                        const endYear = 2050;
                        const count = endYear - startYear + 1;
                        return Array.from({ length: count }, (_, i) => {
                            const year = startYear + i;
                            return {
                                id: year.toString().slice(-2),
                                label: year.toString()
                            };
                        });
                    })();

        const title = modalType === 'dept'
            ? 'Select Department'
            : modalType === 'level'
                ? 'Select Level'
                : modalType === 'entry'
                    ? 'Select Entry Type'
                    : 'Select Year';

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={SLATE_MEDIUM} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={data}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        if (modalType === 'dept') {
                                            setSelectedDept(item);
                                            setSelectedLevel(null);
                                            fetchLevels(item.id);
                                        } else if (modalType === 'level') {
                                            setSelectedLevel(item);
                                        } else if (modalType === 'entry') {
                                            setEntryType(item.id);
                                        } else {
                                            setSelectedYear(item.id);
                                        }
                                        setModalVisible(false);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        (modalType === 'dept'
                                            ? selectedDept?.id === item.id
                                            : modalType === 'level'
                                                ? selectedLevel?.id === item.id
                                                : entryType === item.id) && styles.modalItemTextActive
                                    ]}>
                                        {modalType === 'dept' ? item.name : item.label}
                                    </Text>
                                    {(modalType === 'dept'
                                        ? selectedDept?.id === item.id
                                        : modalType === 'level'
                                            ? selectedLevel?.id === item.id
                                            : modalType === 'entry'
                                                ? entryType === item.id
                                                : selectedYear === item.id) && (
                                            <Ionicons name="checkmark-circle" size={22} color={BLUE_PRIMARY} />
                                        )}
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={[styles.container, isSuccess && { backgroundColor: SLATE_DARK }]}>
            <StatusBar barStyle={isSuccess ? "light-content" : "dark-content"} backgroundColor={isSuccess ? SLATE_DARK : "#FFF"} />

            {isSuccess ? (
                <SuccessView />
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <SelectionModal />

                    {/* Custom Header */}
                    <View style={styles.topHeader}>
                        <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
                            <Ionicons name="chevron-back" size={28} color={BLUE_PRIMARY} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Setup Your Profile</Text>
                        <ProgressIndicator />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {currentStep === 1 && (
                            <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
                                <View style={styles.stepAligner}>
                                    <Text style={styles.sectionTitle}>Contact Details</Text>
                                    <Text style={styles.sectionSubtitle}>Please enter your full name and university email address to get started</Text>

                                    <View style={styles.inputCard}>
                                        <InputField
                                            placeholder="Full Name"
                                            value={fullName}
                                            onChangeText={setFullName}
                                        />
                                        <InputField
                                            placeholder="Email Address"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={() => handleNext()}>
                                        <Text style={styles.primaryBtnText}>Continue</Text>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}

                        {currentStep === 2 && (
                            <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
                                <View style={styles.stepAligner}>
                                    <Text style={styles.sectionTitle}>Security</Text>
                                    <Text style={styles.sectionSubtitle}>Create a 6-digit passcode for your account</Text>

                                    <View style={styles.passcodeContainer}>
                                        {[...Array(6)].map((_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.passcodeBox,
                                                    password.length > i && styles.passcodeBoxFilled,
                                                    password.length === i && styles.passcodeBoxActive
                                                ]}
                                            >
                                                {password.length > i && <Text style={styles.passcodeText}>*</Text>}
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.keypad}>
                                        {[
                                            ['1', '2', '3'],
                                            ['4', '5', '6'],
                                            ['7', '8', '9'],
                                            ['back', '0', 'go']
                                        ].map((row, rowIndex) => (
                                            <View key={rowIndex} style={styles.keypadRow}>
                                                {row.map((key) => (
                                                    <TouchableOpacity
                                                        key={key}
                                                        style={[
                                                            styles.keyBtn,
                                                            key === 'go' && styles.keyBtnPrimary
                                                        ]}
                                                        onPress={() => {
                                                            if (key === 'back') {
                                                                if (password.length > 0) {
                                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                    setPassword(password.slice(0, -1));
                                                                }
                                                            } else if (key === 'go') {
                                                                handleNext();
                                                            } else {
                                                                if (password.length < 6) {
                                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                    const newP = password + key;
                                                                    setPassword(newP);
                                                                    if (newP.length === 6) {
                                                                        handleNext(newP);
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {key === 'back' ? (
                                                            <Ionicons name="backspace-outline" size={24} color={SLATE_MEDIUM} />
                                                        ) : key === 'go' ? (
                                                            <Ionicons name="arrow-forward" size={26} color="#FFF" />
                                                        ) : (
                                                            <Text style={styles.keyText}>{key}</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ))}
                                    </View>

                                    <TouchableOpacity style={[styles.primaryBtn, { marginTop: 30 }]} onPress={() => handleNext()}>
                                        <Text style={styles.primaryBtnText}>Almost Done</Text>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}

                        {currentStep === 3 && (
                            <Animated.View entering={SlideInRight} style={styles.stepContainer}>
                                <View style={styles.stepAligner}>
                                    <Text style={styles.sectionTitle}>Academic Profile</Text>
                                    <Text style={styles.sectionSubtitle}>Tell us about your department and level</Text>

                                    <View style={styles.inputCard}>
                                        <SelectField
                                            placeholder="Select Department"
                                            value={selectedDept?.name}
                                            onPress={() => {
                                                setModalType('dept');
                                                setModalVisible(true);
                                            }}
                                        />
                                        <SelectField
                                            placeholder="Select Level"
                                            value={selectedLevel?.label}
                                            onPress={() => {
                                                if (!selectedDept) {
                                                    Alert.alert('Selection Required', 'Please select a department first');
                                                    return;
                                                }
                                                setModalType('level');
                                                setModalVisible(true);
                                            }}
                                        />

                                        <SelectField
                                            placeholder="Select Entry Type"
                                            value={entryType === 'f' ? 'Fresh' : 'Direct Entry (D.E)'}
                                            onPress={() => {
                                                setModalType('entry');
                                                setModalVisible(true);
                                            }}
                                        />

                                        <SelectField
                                            placeholder="Select Year"
                                            value={`20${selectedYear}`}
                                            onPress={() => {
                                                setModalType('year');
                                                setModalVisible(true);
                                            }}
                                        />

                                        <View style={styles.idRow}>
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>{(selectedDept?.prefix || 'ID').toUpperCase()}/{entryType.toUpperCase()}/{selectedYear || 'YY'}/</Text>
                                            </View>
                                            <TextInput
                                                style={styles.numericInput}
                                                placeholder="001"
                                                value={studentNumber}
                                                onChangeText={(val) => setStudentNumber(val.replace(/[^0-9]/g, '').slice(0, 3))}
                                                keyboardType="numeric"
                                                maxLength={3}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={isLoading}>
                                        {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Complete Setup</Text>}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const InputField = ({ ...props }) => (
    <View style={styles.inputWrapper}>
        <TextInput
            placeholderTextColor={SLATE_MEDIUM}
            style={styles.input}
            {...props}
        />
    </View>
);

const SelectField = ({ placeholder, value, onPress }: any) => (
    <TouchableOpacity style={styles.inputWrapper} onPress={onPress}>
        <Text style={[styles.input, !value && { color: SLATE_MEDIUM }]}>
            {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={SLATE_MEDIUM} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_LIGHT,
    },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: SLATE_DARK },
    progressWrapper: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    progressCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: BLUE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    progressRing: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: 'transparent',
        borderTopColor: BLUE_PRIMARY,
    },
    progressText: { fontSize: 12, fontWeight: '800', color: BLUE_PRIMARY },
    progressTotal: { color: SLATE_MEDIUM, fontSize: 10 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingBottom: 40
    },
    stepContainer: { width: '100%' },
    stepAligner: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 20
    },
    sectionTitle: { fontSize: 28, fontWeight: '800', color: SLATE_DARK, marginBottom: 12 },
    sectionSubtitle: { fontSize: 15, color: SLATE_MEDIUM, fontWeight: '500', lineHeight: 22, marginBottom: 32 },
    inputCard: {
        backgroundColor: SLATE_LIGHT,
        borderRadius: 24,
        padding: 16,
        gap: 12,
        marginBottom: 40,
    },
    inputWrapper: {
        backgroundColor: '#E9ECF1',
        borderRadius: 16,
        height: 60,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    input: { flex: 1, fontSize: 16, fontWeight: '600', color: SLATE_DARK },
    primaryBtn: {
        height: 60,
        borderRadius: 20,
        backgroundColor: BLUE_PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: BLUE_PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    passcodeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 40,
    },
    passcodeBox: {
        width: (width - 100) / 6,
        height: 64,
        borderRadius: 12,
        backgroundColor: SLATE_LIGHT,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    passcodeBoxFilled: {
        borderColor: BLUE_PRIMARY,
        backgroundColor: '#FFF',
    },
    passcodeBoxActive: {
        borderColor: BLUE_PRIMARY,
        backgroundColor: '#FFF',
    },
    passcodeText: {
        fontSize: 32,
        fontWeight: '700',
        color: BLUE_PRIMARY,
        marginTop: 12,
    },
    keypad: { width: '100%', gap: 12 },
    keypadRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    keyBtn: {
        flex: 1,
        height: 64,
        borderRadius: 16,
        backgroundColor: SLATE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBtnPrimary: {
        backgroundColor: BLUE_PRIMARY,
    },
    keyText: { fontSize: 24, fontWeight: '700', color: SLATE_DARK },
    typeToggleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    toggleBtn: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#E9ECF1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toggleBtnActive: { backgroundColor: BLUE_PRIMARY },
    toggleBtnText: { fontSize: 14, fontWeight: '700', color: SLATE_MEDIUM },
    toggleBtnTextActive: { color: '#FFF' },
    idRow: {
        flexDirection: 'row',
        height: 60,
        backgroundColor: '#E9ECF1',
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 4
    },
    badge: {
        backgroundColor: '#D1D5DB',
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    badgeText: { fontSize: 14, fontWeight: '700', color: SLATE_MEDIUM },
    numericInput: { flex: 1, paddingHorizontal: 16, fontSize: 18, fontWeight: '700', color: SLATE_DARK },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '80%',
        paddingTop: 24,
        paddingHorizontal: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_LIGHT,
    },
    modalItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: SLATE_MEDIUM,
    },
    modalItemTextActive: {
        color: BLUE_PRIMARY,
        fontWeight: '700',
    },

    // Success Screen Styles
    successContainer: {
        flex: 1,
        backgroundColor: SLATE_DARK,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: '20%',
        justifyContent: 'space-between',
    },
    successContent: {
        alignItems: 'center',
    },
    checkOutline3: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 48,
    },
    checkOutline2: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkOutline1: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    successTitle: {
        fontSize: 34,
        fontWeight: '800',
        color: '#FFF',
        textAlign: 'center',
        lineHeight: 42,
        marginBottom: 20,
    },
    successSubtitle: {
        fontSize: 16,
        color: SLATE_MEDIUM,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 12,
    },
    successBtn: {
        height: 64,
        borderRadius: 20,
        backgroundColor: '#FBDF4B', // Premium Moniepoint Yellow
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    successBtnText: {
        color: SLATE_DARK,
        fontSize: 18,
        fontWeight: '800',
    },
    confettiPiece: {
        position: 'absolute',
        borderRadius: 2,
    },
});
