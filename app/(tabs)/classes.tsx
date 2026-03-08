import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, Dimensions, Image, Animated, Easing, Modal, Pressable, ScrollView, TextInput, StatusBar, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ReAnimated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    withDelay,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

const { width: windowWidth, height } = Dimensions.get('window');
const width = Math.min(windowWidth, 600);

const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';
const SLATE_LIGHT = '#F8FAFC';
const SUCCESS_GREEN = '#22C55E';

export default function AttendanceCameraScreen() {
    const [isLoading, setIsLoading] = useState(false);
    const [successMatch, setSuccessMatch] = useState<{ name: string; regNumber: string; level: string; time: string } | null>(null);
    const [courses, setCourses] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [courseModal, setCourseModal] = useState(false);
    const [isFetchingCourses, setIsFetchingCourses] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);

    const [attendanceMode, setAttendanceMode] = useState<'courses' | 'activities' | 'methods' | 'code' | 'fingerprint' | 'generate_code' | 'success' | 'qr_scan'>('courses');
    const [attendanceCode, setAttendanceCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [todayAttendance, setTodayAttendance] = useState<any[]>([]);

    useEffect(() => {
        fetchStudentAssignedCourses();
        checkBiometrics();
        fetchUnreadCount();
    }, []);

    const checkBiometrics = async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(hasHardware);
        setIsBiometricEnrolled(isEnrolled);
    };

    const fetchStudentAssignedCourses = async () => {
        setIsFetchingCourses(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get student profile
            const { data: student } = await supabase
                .from('students')
                .select('department_id, level_id, department, level, registration_number')
                .eq('id', user.id)
                .single();

            if (!student) return;

            // Fetch courses for that department and level
            let query = supabase.from('courses').select('*, departments!inner(name), levels!inner(label)');

            if (student.department_id && student.level_id) {
                query = query.eq('department_id', student.department_id)
                    .eq('level_id', student.level_id);
            } else {
                // Fallback for legacy data - filter by name (matching Dashboard logic)
                console.warn('Legacy student profile: missing IDs. Falling back to name filtering.');
                query = query.eq('departments.name', student.department)
                    .eq('levels.label', student.level);
            }

            const { data, error } = await query;

            if (error) throw error;
            setCourses(data || []);

            // 3. Fetch today's attendance for this student to prevent duplicates
            const today = new Date().toISOString().split('T')[0];
            const { data: attData } = await supabase
                .from('attendance')
                .select('course_code')
                .eq('registration_number', student.registration_number || '')
                .eq('date', today);

            setTodayAttendance(attData || []);

            // Handle incoming courseId from navigation
            if (params.courseId && data) {
                const preselected = data.find((c: any) => c.id.toString() === params.courseId);
                if (preselected) {
                    setSelectedCourse(preselected);
                    setAttendanceMode('activities');
                }
            }
        } catch (error) {
            console.error('Error fetching assigned courses:', error);
        } finally {
            setIsFetchingCourses(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const { data } = await supabase.from('courses').select('*').order('name');
            setCourses(data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    };

    const isWithinSchedule = (sessionDay: string, startTimeStr: string, durationStr: string) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const now = new Date();
        const currentDay = days[now.getDay()];

        const isToday = sessionDay && sessionDay.toLowerCase() === currentDay.toLowerCase();

        if (!isToday) {
            return { valid: false, isToday: false, isUpcoming: false, reason: `This course is scheduled for ${sessionDay}, but today is ${currentDay}.` };
        }

        if (!startTimeStr) return { valid: true, isToday: true, isUpcoming: false };

        const match = startTimeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
        if (!match) return { valid: true, isToday: true, isUpcoming: false };

        try {
            let startHours = parseInt(match[1]);
            const startMinutes = parseInt(match[2] || '0');
            const ampm = match[3].toUpperCase();

            if (ampm === 'PM' && startHours < 12) startHours += 12;
            if (ampm === 'AM' && startHours === 12) startHours = 0;

            const startDate = new Date(now);
            startDate.setHours(startHours, startMinutes, 0, 0);

            const duration = parseInt(durationStr) || 1;
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + duration);

            const isActive = now >= startDate && now <= endDate;
            const isUpcoming = now < startDate;

            if (isActive) return { valid: true, isToday: true, isUpcoming: false };

            const endStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return {
                valid: false,
                isToday: true,
                isUpcoming: isUpcoming,
                reason: isUpcoming
                    ? `Starts at ${startTimeStr}.`
                    : `Ended at ${endStr}.`
            };
        } catch (e) {
            return { valid: true, isToday: true, isUpcoming: false };
        }
    };

    const logAttendanceToBoth = async (method: 'fingerprint' | 'passcode' | 'qr', code?: string) => {
        if (!selectedCourse) {
            Alert.alert('Error', 'No course selected.');
            return;
        }

        // --- Time Window Check ---
        const scheduleCheck = isWithinSchedule(
            selectedCourse.session_day,
            selectedCourse.session_time,
            selectedCourse.duration
        );

        if (!scheduleCheck.valid) {
            Alert.alert('Session Closed', scheduleCheck.reason);
            return;
        }
        // -------------------------

        // --- Daily Limit Check ---
        const alreadyMarked = todayAttendance.some(a => a.course_code === selectedCourse?.code);
        if (alreadyMarked) {
            Alert.alert('Already Marked', 'You have already marked attendance for this course today.');
            return;
        }
        // -------------------------

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in to mark attendance.');

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('id', user.id)
                .single();

            if (studentError || !student) throw new Error('Could not find your student profile.');

            const displayMethod =
                method === 'fingerprint' ? 'Self (Fingerprint)' :
                    method === 'qr' ? 'Self (QR Scan)' :
                        `Self (Code: ${code})`;

            // 1. Log to attendance_logs (Supabase Direct)
            await supabase
                .from('attendance_logs')
                .insert({
                    student_id: student.id,
                    course_id: selectedCourse.id,
                    status: 'Present',
                    marked_by: method,
                    timestamp: new Date().toISOString(),
                });

            // 2. Log to attendance (Backend Compatibility)
            await supabase
                .from('attendance')
                .insert({
                    student_id: student.id, // Added for strict tracking
                    name: student.full_name,
                    date: new Date().toISOString().split('T')[0],
                    course_code: selectedCourse.code,
                    registration_number: student.registration_number,
                    department: student.department_id || selectedCourse.department_id,
                    level: student.level_id || selectedCourse.level_id,
                    method: method === 'fingerprint' ? 'Fingerprint' : method === 'qr' ? 'QR Code' : 'Passcode'
                });

            setSuccessMatch({
                name: student.full_name,
                regNumber: student.registration_number,
                level: student.level_id || 'N/A',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            setAttendanceMode('success');
            setAttendanceCode(''); // Clear code after success
        } catch (error: any) {
            console.error('Attendance logging error:', error);
            Alert.alert('Error', error.message || 'Failed to mark attendance.');
            setAttendanceMode('courses'); // Go back to courses on error
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('student_id', session.user.id)
                .eq('is_read', false);

            if (!error) setUnreadCount(count || 0);
        } catch (e) {
            console.error('Error fetching unread count:', e);
        }
    };

    const handleBiometricAuth = async () => {
        if (!selectedCourse) {
            Alert.alert('Course Required', 'Please select a course first');
            return;
        }

        if (!isBiometricSupported || !isBiometricEnrolled) {
            Alert.alert('Biometrics Unavailable', 'Your device does not support or have biometrics enrolled.');
            return;
        }

        setAttendanceMode('fingerprint');
    };

    const triggerBiometricPrompt = async () => {
        try {
            setIsLoading(true);

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Mark Attendance with Fingerprint',
                disableDeviceFallback: true,
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await logAttendanceToBoth('fingerprint'); // Biometric = true
                return true;
            }
            return false;
        } catch (error) {
            console.error('Biometric error:', error);
            Alert.alert('Error', 'Biometric authentication failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleCodeAuth = async (code: string) => {
        if (!selectedCourse) {
            Alert.alert('Select Course', 'Please select a course before marking attendance.');
            return;
        }

        if (!code || code.length < 4) {
            Alert.alert('Invalid Code', 'Please enter a valid 4-digit attendance code.');
            return;
        }

        // Logic for code verification (lecturer generated or default)
        const isValid = (code === '1234' || code === selectedCourse.code.slice(-4));

        if (!isValid) {
            Alert.alert('Verification Failed', 'The code you entered is incorrect. Please ask your lecturer for the code.');
            setAttendanceCode(''); // Clear code on failure
            return;
        }

        setIsLoading(true);
        await logAttendanceToBoth('passcode', code); // Not biometric, pass code
        setIsLoading(false);
    };

    const handleSelectCourse = (course: any) => {
        setSelectedCourse(course);
        setAttendanceMode('activities');
        setGeneratedCode(null); // Reset generated code when switching courses
    };

    const handleGenerateCode = async () => {
        if (!isBiometricSupported || !isBiometricEnrolled) {
            Alert.alert('Biometrics Unavailable', 'Your device does not support or have biometrics enrolled. Fingerprint is required to generate a secure code.');
            return;
        }

        try {
            setIsGenerating(true);
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to Generate Attendance Code',
                disableDeviceFallback: true,
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // For now, let's generate a pseudo-random 4-digit code based on timestamp and course code
                const newCode = Math.floor(1000 + Math.random() * 9000).toString();
                setGeneratedCode(newCode);
            }
        } catch (error) {
            console.error('Generation auth error:', error);
            Alert.alert('Error', 'Authentication failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const FingerprintView = () => {
        const pulse1 = useSharedValue(1);
        const pulse2 = useSharedValue(1);

        useEffect(() => {
            pulse1.value = withRepeat(withTiming(1.5, { duration: 2000 }), -1, true);
            pulse2.value = withDelay(1000, withRepeat(withTiming(1.5, { duration: 2000 }), -1, true));
        }, []);

        const ringStyle1 = useAnimatedStyle(() => ({
            transform: [{ scale: pulse1.value }],
            opacity: interpolate(pulse1.value, [1, 1.5], [0.4, 0])
        }));

        const ringStyle2 = useAnimatedStyle(() => ({
            transform: [{ scale: pulse2.value }],
            opacity: interpolate(pulse2.value, [1, 1.5], [0.4, 0])
        }));

        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
                <LinearGradient colors={[BLUE_PRIMARY, '#1E40AF']} style={StyleSheet.absoluteFill} />

                <TouchableOpacity
                    style={styles.backButtonAbsolute}
                    onPress={() => setAttendanceMode('activities')}
                >
                    <Ionicons name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>

                <View style={styles.centerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.biometricContainer, todayAttendance.some(a => a.course_code === selectedCourse?.code) && { opacity: 0.6 }]}
                        onPress={triggerBiometricPrompt}
                        disabled={isLoading || todayAttendance.some(a => a.course_code === selectedCourse?.code)}
                    >
                        {!todayAttendance.some(a => a.course_code === selectedCourse?.code) && (
                            <>
                                <ReAnimated.View style={[styles.pulseRing, ringStyle1]} />
                                <ReAnimated.View style={[styles.pulseRing, ringStyle2]} />
                            </>
                        )}
                        <View style={[styles.biometricCircle, todayAttendance.some(a => a.course_code === selectedCourse?.code) && { backgroundColor: '#64748B' }]}>
                            <Ionicons name={todayAttendance.some(a => a.course_code === selectedCourse?.code) ? "checkmark-circle" : "finger-print"} size={80} color="#FFF" />
                        </View>
                    </TouchableOpacity>

                    <ReAnimated.View entering={FadeInDown.delay(300)} style={{ alignItems: 'center' }}>
                        <Text style={styles.modeTitle}>
                            {todayAttendance.some(a => a.course_code === selectedCourse?.code) ? "Attendance Logged" : "Biometric Scan"}
                        </Text>
                        <Text style={styles.modeSubtitle}>
                            {todayAttendance.some(a => a.course_code === selectedCourse?.code)
                                ? `You have already marked attendance for ${selectedCourse?.name} today.`
                                : `Please place your finger on the sensor to mark attendance for ${selectedCourse?.name}`}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.scanBtn,
                                (isLoading || todayAttendance.some(a => a.course_code === selectedCourse?.code)) && { opacity: 0.7 }
                            ]}
                            onPress={triggerBiometricPrompt}
                            disabled={isLoading || todayAttendance.some(a => a.course_code === selectedCourse?.code)}
                        >
                            <LinearGradient
                                colors={todayAttendance.some(a => a.course_code === selectedCourse?.code) ? ['#64748B', '#475569'] : ['#FBDF4B', '#FACC15']}
                                style={styles.scanBtnGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={SLATE_DARK} />
                                ) : todayAttendance.some(a => a.course_code === selectedCourse?.code) ? (
                                    <>
                                        <Text style={styles.scanBtnText}>ALREADY MARKED TODAY</Text>
                                        <Ionicons name="calendar" size={22} color="#FFF" style={{ marginLeft: 8 }} />
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.scanBtnText}>Begin Scan</Text>
                                        <Ionicons name="finger-print" size={20} color={SLATE_DARK} style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </ReAnimated.View>
                </View>
            </ReAnimated.View>
        );
    };

    const SuccessView = () => (
        <ReAnimated.View entering={FadeIn} style={styles.successContainer}>
            <LinearGradient colors={[SLATE_DARK, '#0F172A']} style={StyleSheet.absoluteFill} />
            <View style={styles.successContent}>
                <ReAnimated.View entering={FadeInDown.springify()} style={styles.checkOutline3}>
                    <View style={styles.checkOutline2}>
                        <View style={styles.checkOutline1}>
                            <View style={styles.checkCircle}>
                                <Ionicons name="checkmark" size={42} color="#FFF" />
                            </View>
                        </View>
                    </View>
                </ReAnimated.View>

                <ReAnimated.View entering={FadeInDown.delay(200).springify()}>
                    <Text style={styles.successTitle}>Attendance{"\n"}Recorded!</Text>
                    <Text style={styles.successSubtitle}>
                        Successfully marked for <Text style={{ color: '#FFF', fontWeight: '700' }}>{selectedCourse?.name}</Text>.{"\n"}
                        Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </ReAnimated.View>
            </View>

            <TouchableOpacity
                style={styles.successBtn}
                onPress={() => {
                    setSuccessMatch(null);
                    setAttendanceCode('');
                    setGeneratedCode(null);
                    setAttendanceMode('courses');
                }}
            >
                <Text style={styles.successBtnText}>Done</Text>
            </TouchableOpacity>
        </ReAnimated.View>
    );

    const GenerateCodeView = () => (
        <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
            <LinearGradient colors={['#7C3AED', '#4C1D95']} style={StyleSheet.absoluteFill} />

            <TouchableOpacity
                style={styles.backButtonAbsolute}
                onPress={() => setAttendanceMode('activities')}
            >
                <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.centerContent}>
                <View style={[styles.biometricCircle, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="qr-code" size={80} color="#FFF" />
                </View>

                <ReAnimated.View entering={FadeInDown.delay(300)} style={{ alignItems: 'center', width: '100%' }}>
                    <Text style={styles.modeTitle}>Generate Code</Text>
                    <Text style={styles.modeSubtitle}>Securely generate a check-in token for {selectedCourse?.name}</Text>

                    {generatedCode ? (
                        <ReAnimated.View entering={FadeIn.springify()} style={styles.generatedCodeContainer}>
                            <Text style={styles.generatedCodeLabel}>YOUR UNIQUE CODE</Text>
                            <Text style={styles.generatedCodeText}>{generatedCode}</Text>
                            <Text style={styles.generatedCodeExpiry}>Expires in 10:00</Text>
                        </ReAnimated.View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.scanBtn, { backgroundColor: '#FFF' }]}
                            onPress={handleGenerateCode}
                            disabled={isGenerating}
                        >
                            <View style={styles.scanBtnGradient}>
                                {isGenerating ? (
                                    <ActivityIndicator color={SLATE_DARK} />
                                ) : (
                                    <>
                                        <Text style={[styles.scanBtnText, { color: '#7C3AED' }]}>Verify & Generate</Text>
                                        <Ionicons name="finger-print" size={20} color="#7C3AED" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                </ReAnimated.View>
            </View>
        </ReAnimated.View>
    );

    const QRScannerView = () => {
        const [permission, requestPermission] = useCameraPermissions();
        const [scanned, setScanned] = useState(false);

        const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
            setScanned(true);
            if (data === selectedCourse?.code) { // Example: QR code data matches course code
                Alert.alert('QR Code Matched!', `Scanned: ${data}`);
                await logAttendanceToBoth('qr', data);
            } else {
                Alert.alert('Invalid QR Code', 'The scanned QR code does not match this course.');
            }
            // Optionally reset scanned state after a delay to allow re-scanning
            setTimeout(() => setScanned(false), 2000);
        };

        if (!permission) {
            return (
                <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
                    <LinearGradient colors={[BLUE_PRIMARY, '#1E40AF']} style={StyleSheet.absoluteFill} />
                    <View style={styles.centerContent}>
                        <Text style={styles.modeTitle}>Requesting Camera Permission</Text>
                    </View>
                </ReAnimated.View>
            );
        }
        if (!permission.granted) {
            return (
                <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
                    <LinearGradient colors={[BLUE_PRIMARY, '#1E40AF']} style={StyleSheet.absoluteFill} />
                    <View style={styles.centerContent}>
                        <Text style={styles.modeTitle}>No access to camera</Text>
                        <Text style={styles.modeSubtitle}>Please enable camera permissions in your device settings.</Text>
                        <TouchableOpacity
                            style={[styles.scanBtn, { marginBottom: 12 }]}
                            onPress={requestPermission}
                        >
                            <Text style={styles.scanBtnText}>Grant Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.scanBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFF' }]}
                            onPress={() => setAttendanceMode('activities')}
                        >
                            <Text style={[styles.scanBtnText, { color: '#FFF' }]}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                </ReAnimated.View>
            );
        }

        return (
            <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
                <LinearGradient colors={[BLUE_PRIMARY, '#1E40AF']} style={StyleSheet.absoluteFill} />

                <TouchableOpacity
                    style={styles.backButtonAbsolute}
                    onPress={() => setAttendanceMode('activities')}
                >
                    <Ionicons name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>

                <View style={styles.centerContent}>
                    <Text style={styles.modeTitle}>Scan QR Code</Text>
                    <Text style={styles.modeSubtitle}>Align the QR code within the frame to mark attendance for {selectedCourse?.name}</Text>

                    <View style={styles.qrScannerContainer}>
                        <CameraView
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                            style={StyleSheet.absoluteFillObject}
                        />
                        {scanned && (
                            <View style={styles.qrOverlay}>
                                <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
                                <Text style={styles.qrOverlayText}>Scanned!</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.scanBtn, { marginTop: 20 }]}
                        onPress={() => setScanned(false)}
                        disabled={!scanned}
                    >
                        <Text style={styles.scanBtnText}>Rescan</Text>
                    </TouchableOpacity>
                </View>
            </ReAnimated.View>
        );
    };

    const AttendanceMethodsView = () => (
        <ReAnimated.View entering={FadeIn} exiting={FadeOut} style={styles.fullPageMode}>
            <LinearGradient colors={[BLUE_PRIMARY, '#1E40AF']} style={StyleSheet.absoluteFill} />

            <TouchableOpacity
                style={styles.backButtonAbsolute}
                onPress={() => setAttendanceMode('activities')}
            >
                <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.centerContent}>
                <View style={[styles.biometricCircle, { borderColor: 'rgba(255,255,255,0.3)' }]}>
                    <Ionicons name="finger-print" size={80} color="#FFF" />
                </View>

                <ReAnimated.View entering={FadeInDown.delay(300)} style={{ alignItems: 'center', width: '100%' }}>
                    <Text style={styles.modeTitle}>Verification Method</Text>
                    <Text style={styles.modeSubtitle}>Choose how you want to mark attendance for {selectedCourse?.name}</Text>

                    <View style={styles.gridContainer}>
                        <TouchableOpacity
                            style={[styles.methodCard, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setAttendanceMode('fingerprint')}
                        >
                            <View style={styles.methodIconWrapper}>
                                <Ionicons name="finger-print" size={32} color="#FFF" />
                            </View>
                            <Text style={styles.methodTitle}>Fingerprint</Text>
                            <Text style={styles.methodDesc}>Use your device's biometric sensor</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.methodCard, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setAttendanceMode('code')}
                        >
                            <View style={styles.methodIconWrapper}>
                                <Ionicons name="keypad" size={32} color="#FFF" />
                            </View>
                            <Text style={styles.methodTitle}>Session Code</Text>
                            <Text style={styles.methodDesc}>Enter the 4-digit code provided</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.methodCard, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setAttendanceMode('qr_scan')}
                        >
                            <View style={styles.methodIconWrapper}>
                                <Ionicons name="qr-code" size={32} color="#FFF" />
                            </View>
                            <Text style={styles.methodTitle}>QR Scan</Text>
                            <Text style={styles.methodDesc}>Scan the code from the Admin</Text>
                        </TouchableOpacity>
                    </View>
                </ReAnimated.View>
            </View>
        </ReAnimated.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={BLUE_PRIMARY} />

            {successMatch ? (
                <SuccessView />
            ) : attendanceMode === 'fingerprint' ? (
                <FingerprintView />
            ) : attendanceMode === 'methods' ? (
                <AttendanceMethodsView />
            ) : attendanceMode === 'generate_code' ? (
                <GenerateCodeView />
            ) : attendanceMode === 'qr_scan' ? (
                <QRScannerView />
            ) : attendanceMode === 'courses' ? (
                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.greeting}>Academics</Text>
                                <Text style={styles.subGreeting}>Your assigned courses and activities</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => router.push('/(tabs)/notifications')}
                                    style={styles.profileBtn}
                                >
                                    <Ionicons name="notifications-outline" size={20} color={BLUE_PRIMARY} />
                                    {unreadCount > 0 && (
                                        <View style={styles.notificationDot} />
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.profileBtn}>
                                    <Ionicons name="school" size={20} color={BLUE_PRIMARY} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Schedule Sections */}
                        {isFetchingCourses ? (
                            <ActivityIndicator color={BLUE_PRIMARY} style={{ marginTop: 20 }} />
                        ) : courses.length > 0 ? (
                            (() => {
                                const ongoing: any[] = [];
                                const upcomingToday: any[] = [];
                                const otherCourses: any[] = [];

                                courses.forEach(course => {
                                    const schedule = isWithinSchedule(course.session_day, course.session_time, course.duration);
                                    if (schedule.valid) {
                                        ongoing.push({ ...course, schedule });
                                    } else if (schedule.isToday && schedule.isUpcoming) {
                                        upcomingToday.push({ ...course, schedule });
                                    } else {
                                        otherCourses.push({ ...course, schedule });
                                    }
                                });

                                const renderCourseCard = (course: any, type: 'ongoing' | 'upcoming' | 'other', index: number) => {
                                    const isActive = type === 'ongoing';
                                    const isUpcoming = type === 'upcoming';

                                    return (
                                        <TouchableOpacity
                                            key={`${type}-${index}`}
                                            style={[
                                                styles.courseItemLarge,
                                                isActive && styles.ongoingCard,
                                                isUpcoming && styles.upcomingCardToday
                                            ]}
                                            onPress={() => handleSelectCourse(course)}
                                        >
                                            <View style={[
                                                styles.courseIconBox,
                                                { backgroundColor: isActive ? "#FFF" : isUpcoming ? "#FFFBEB" : BLUE_LIGHT }
                                            ]}>
                                                <Ionicons
                                                    name={isActive ? "flash" : "book"}
                                                    size={24}
                                                    color={isActive ? BLUE_PRIMARY : isUpcoming ? "#D97706" : BLUE_PRIMARY}
                                                />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 16 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={[styles.courseItemCode, isActive && { color: '#FFF' }]}>{course.code}</Text>
                                                    {isActive && (
                                                        <View style={styles.liveBadge}>
                                                            <View style={styles.liveDot} />
                                                            <Text style={styles.liveBadgeText}>ONGOING</Text>
                                                        </View>
                                                    )}
                                                    {isUpcoming && (
                                                        <View style={styles.upcomingBadge}>
                                                            <Text style={styles.upcomingBadgeText}>TODAY</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.courseItemName, isActive && { color: '#FFF' }]}>{course.name}</Text>

                                                <View style={styles.scheduleMetaRow}>
                                                    <Ionicons name="time-outline" size={12} color={isActive ? "rgba(255,255,255,0.8)" : SLATE_MEDIUM} />
                                                    <Text style={[styles.scheduleMetaText, isActive && { color: "rgba(255,255,255,0.9)" }]}>
                                                        {isActive ? `Started at ${course.session_time}` : isUpcoming ? `Starts at ${course.session_time}` : `${course.session_day || 'No schedule'} · ${course.session_time || 'No time'}`}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={isActive ? "#FFF" : SLATE_MEDIUM} />
                                        </TouchableOpacity>
                                    );
                                };

                                return (
                                    <>
                                        {/* Ongoing Now Section */}
                                        {ongoing.length > 0 && (
                                            <View style={styles.sectionHeaderWrap}>
                                                <Text style={styles.sectionTitle}>Ongoing Now</Text>
                                                <View style={styles.sectionActiveLine} />
                                            </View>
                                        )}
                                        {ongoing.map((c, i) => renderCourseCard(c, 'ongoing', i))}

                                        {/* Later Today Section */}
                                        {upcomingToday.length > 0 && (
                                            <View style={[styles.sectionHeaderWrap, { marginTop: 12 }]}>
                                                <Text style={styles.sectionTitle}>Upcoming Today</Text>
                                            </View>
                                        )}
                                        {upcomingToday.map((c, i) => renderCourseCard(c, 'upcoming', i))}

                                        {/* No Lectures Today Hint */}
                                        {ongoing.length === 0 && upcomingToday.length === 0 && (
                                            <View style={styles.todayNoClassCard}>
                                                <View style={styles.infoCircle}>
                                                    <Ionicons name="calendar-outline" size={24} color={SLATE_MEDIUM} />
                                                </View>
                                                <Text style={styles.todayNoClassText}>No lectures scheduled for today.</Text>
                                            </View>
                                        )}

                                        {/* All Courses Section */}
                                        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 16 }]}>All Enrolled Courses</Text>
                                        {otherCourses.map((c, i) => renderCourseCard(c, 'other', i))}
                                    </>
                                );
                            })()
                        ) : (
                            <View style={styles.emptyStateContainer}>
                                <Ionicons name="file-tray-outline" size={60} color={SLATE_LIGHT} />
                                <Text style={styles.emptyText}>No assigned courses found.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            ) : attendanceMode === 'activities' ? (
                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setAttendanceMode('courses')}
                        >
                            <Ionicons name="arrow-back" size={24} color={SLATE_DARK} />
                        </TouchableOpacity>

                        <View style={styles.activityHeader}>
                            <Text style={styles.activityCourseCode}>{selectedCourse?.code}</Text>
                            <Text style={styles.activityCourseName}>{selectedCourse?.name}</Text>
                            <Text style={styles.activitySub}>Select an activity to proceed</Text>
                        </View>

                        <Text style={styles.sectionTitle}>Available Activities</Text>

                        <TouchableOpacity
                            style={[styles.activityCard, { borderLeftColor: BLUE_PRIMARY }]}
                            onPress={() => setAttendanceMode('methods')}
                        >
                            <View style={[styles.activityIconBox, { backgroundColor: BLUE_LIGHT }]}>
                                <Ionicons name="calendar" size={28} color={BLUE_PRIMARY} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityTitle}>Mark Attendance</Text>
                                <Text style={styles.activityDesc}>Biometric or code-based verification</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={SLATE_MEDIUM} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.activityCard, { borderLeftColor: '#16A34A' }]}
                            onPress={() => Alert.alert('Books for Sale', 'Course materials marketplace coming soon!')}
                        >
                            <View style={[styles.activityIconBox, { backgroundColor: '#F0FDF4' }]}>
                                <Ionicons name="cart" size={28} color="#16A34A" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityTitle}>Books for Sale</Text>
                                <Text style={styles.activityDesc}>Purchase course textbooks and manuals</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={SLATE_MEDIUM} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.activityCard, { borderLeftColor: '#7C3AED' }]}
                            onPress={() => setAttendanceMode('generate_code')}
                        >
                            <View style={[styles.activityIconBox, { backgroundColor: '#F5F3FF' }]}>
                                <Ionicons name="qr-code" size={28} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityTitle}>Generate Code</Text>
                                <Text style={styles.activityDesc}>Generate unique attendance token</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={SLATE_MEDIUM} />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.greeting}>Academics</Text>
                                <Text style={styles.subGreeting}>Select an assigned course to manage activities</Text>
                            </View>
                        </View>
                        <View style={styles.emptyStateContainer}>
                            <Ionicons name="book-outline" size={60} color={SLATE_LIGHT} />
                            <Text style={styles.emptyText}>Navigate to "Dashboard" to see your summary</Text>
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Quick Action FAB for quick attendance */}
            <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => router.push('/(tabs)/register' as any)}
                activeOpacity={0.85}
            >
                <LinearGradient
                    colors={['#2563EB', '#1D4ED8']}
                    style={styles.fabGradient}
                >
                    <Ionicons name="finger-print" size={28} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Numeric Code Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={attendanceMode === 'code'}
                onRequestClose={() => setAttendanceMode('methods')}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setAttendanceMode('methods')}>
                    <Pressable style={styles.codeModal} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.codeModalTitle}>Enter Session Code</Text>
                        <Text style={styles.codeModalSub}>Ask your lecturer for the 4-digit attendance code</Text>

                        <View style={styles.codeInputsContainer}>
                            {[...Array(4)].map((_, i) => (
                                <View key={i} style={[styles.codeInputCell, attendanceCode.length === i && styles.codeInputCellActive]}>
                                    {attendanceCode.length > i && <View style={styles.codeDot} />}
                                </View>
                            ))}
                        </View>

                        <View style={styles.keypad}>
                            {[
                                ['1', '2', '3'],
                                ['4', '5', '6'],
                                ['7', '8', '9'],
                                ['', '0', 'back']
                            ].map((row, i) => (
                                <View key={i} style={styles.keypadRow}>
                                    {row.map((key) => (
                                        <TouchableOpacity
                                            key={key}
                                            style={styles.key}
                                            onPress={() => {
                                                if (key === 'back') {
                                                    setAttendanceCode(prev => prev.slice(0, -1));
                                                } else if (key !== '') {
                                                    if (attendanceCode.length < 4) {
                                                        const newCode = attendanceCode + key;
                                                        setAttendanceCode(newCode);
                                                        if (newCode.length === 4) handleCodeAuth(newCode);
                                                    }
                                                }
                                            }}
                                        >
                                            {key === 'back' ? (
                                                <Ionicons name="backspace" size={24} color={SLATE_MEDIUM} />
                                            ) : (
                                                <Text style={styles.keyText}>{key}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Course Selection Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={courseModal}
                onRequestClose={() => setCourseModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.courseModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Course</Text>
                            <TouchableOpacity onPress={() => setCourseModal(false)}>
                                <Ionicons name="close" size={24} color={SLATE_MEDIUM} />
                            </TouchableOpacity>
                        </View>

                        {isFetchingCourses ? (
                            <ActivityIndicator color={BLUE_PRIMARY} size="large" style={{ marginVertical: 40 }} />
                        ) : (
                            <FlatList
                                data={courses}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.courseItem}
                                        onPress={() => {
                                            setSelectedCourse(item);
                                            setCourseModal(false);
                                        }}
                                    >
                                        <View style={styles.courseItemIcon}>
                                            <Ionicons name="book-outline" size={20} color={BLUE_PRIMARY} />
                                        </View>
                                        <Text style={styles.courseItemText}>{item.name}</Text>
                                        {selectedCourse?.id === item.id && (
                                            <Ionicons name="checkmark-circle" size={22} color={BLUE_PRIMARY} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    scrollContent: { padding: 24 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    greeting: { fontSize: 32, fontWeight: '800', color: SLATE_DARK },
    subGreeting: { fontSize: 16, color: SLATE_MEDIUM, marginTop: 4 },
    profileBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: BLUE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SLATE_LIGHT,
        padding: 20,
        borderRadius: 24,
        marginBottom: 32,
    },
    courseIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseLabel: { fontSize: 12, fontWeight: '700', color: SLATE_MEDIUM, textTransform: 'uppercase', marginBottom: 4 },
    courseName: { fontSize: 18, fontWeight: '700', color: SLATE_DARK },
    gridContainer: { gap: 20 },
    methodCard: {
        padding: 24,
        borderRadius: 28,
        minHeight: 180,
    },
    methodIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    methodTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
    methodDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },

    // Full Page Mode
    fullPageMode: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backButtonAbsolute: {
        position: 'absolute',
        top: 60,
        left: 24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContent: { alignItems: 'center', paddingHorizontal: 40 },
    biometricContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 48,
    },
    biometricCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    pulseRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#FFF',
    },
    modeTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', textAlign: 'center' },
    modeSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 12, lineHeight: 24, marginBottom: 32 },
    scanBtn: {
        width: 220,
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    scanBtnGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanBtnText: {
        color: SLATE_DARK,
        fontSize: 18,
        fontWeight: '800',
    },

    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    codeModal: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 32,
        alignItems: 'center',
    },
    codeModalTitle: { fontSize: 24, fontWeight: '800', color: SLATE_DARK },
    codeModalSub: { fontSize: 14, color: SLATE_MEDIUM, marginTop: 8, textAlign: 'center', marginBottom: 32 },
    codeInputsContainer: { flexDirection: 'row', gap: 16, marginBottom: 40 },
    codeInputCell: {
        width: 60,
        height: 72,
        borderRadius: 16,
        backgroundColor: SLATE_LIGHT,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeInputCellActive: { borderColor: BLUE_PRIMARY, backgroundColor: '#FFF' },
    codeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: BLUE_PRIMARY },
    keypad: { width: '100%', gap: 12 },
    keypadRow: { flexDirection: 'row', gap: 12 },
    key: {
        flex: 1,
        height: 64,
        borderRadius: 16,
        backgroundColor: SLATE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyText: { fontSize: 22, fontWeight: '700', color: SLATE_DARK },

    // Course Selection
    courseModalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        maxHeight: '80%',
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 22, fontWeight: '800', color: SLATE_DARK },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_LIGHT,
    },
    courseItemIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: BLUE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    courseItemText: { flex: 1, fontSize: 16, fontWeight: '600', color: SLATE_DARK },

    // Success Screen
    successContainer: { flex: 1 },
    successContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
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
    },
    successTitle: { fontSize: 36, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 16 },
    successSubtitle: { fontSize: 16, color: SLATE_MEDIUM, textAlign: 'center', lineHeight: 24 },
    successBtn: {
        margin: 24,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#FBDF4B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successBtnText: { color: SLATE_DARK, fontSize: 18, fontWeight: '800' },

    // New styles for Courses Activity flow
    sectionTitle: { fontSize: 20, fontWeight: '800', color: SLATE_DARK, marginBottom: 16, marginTop: 8 },
    courseItemLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: SLATE_LIGHT,
        borderRadius: 24,
        marginBottom: 16,
    },
    courseIconBox: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseItemCode: { fontSize: 12, fontWeight: '800', color: BLUE_PRIMARY, marginBottom: 2 },
    courseItemName: { fontSize: 16, fontWeight: '700', color: SLATE_DARK },
    activityBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    activityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: BLUE_LIGHT,
        borderRadius: 6,
    },
    activityBadgeText: { fontSize: 10, fontWeight: '700', color: BLUE_PRIMARY },

    // Schedule Specific Styles
    ongoingCard: {
        backgroundColor: BLUE_PRIMARY,
        borderColor: BLUE_PRIMARY,
        borderWidth: 1,
        shadowColor: BLUE_PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    upcomingCardToday: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        borderWidth: 1,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ADE80',
    },
    liveBadgeText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    upcomingBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    upcomingBadgeText: {
        color: '#D97706',
        fontSize: 9,
        fontWeight: '900',
    },
    scheduleMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    scheduleMetaText: {
        fontSize: 12,
        color: SLATE_MEDIUM,
        fontWeight: '600',
    },
    sectionHeaderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    sectionActiveLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    todayNoClassCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: SLATE_LIGHT,
        borderRadius: 24,
        marginBottom: 16,
        gap: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    todayNoClassText: {
        fontSize: 14,
        color: SLATE_MEDIUM,
        fontWeight: '600',
        flexShrink: 1,
    },
    infoCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },

    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: SLATE_LIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    activityHeader: { marginBottom: 32 },
    activityCourseCode: { fontSize: 14, fontWeight: '800', color: BLUE_PRIMARY },
    activityCourseName: { fontSize: 28, fontWeight: '800', color: SLATE_DARK, marginTop: 4 },
    activitySub: { fontSize: 16, color: SLATE_MEDIUM, marginTop: 8 },

    notificationDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFF',
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderLeftWidth: 6,
    },
    activityIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activityTitle: { fontSize: 18, fontWeight: '700', color: SLATE_DARK },
    activityDesc: { fontSize: 14, color: SLATE_MEDIUM, marginTop: 2 },

    emptyStateContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, color: SLATE_MEDIUM, marginTop: 16, fontWeight: '600' },

    // Generate Code Styles
    generatedCodeContainer: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: 32,
        borderRadius: 32,
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    generatedCodeLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 2,
        marginBottom: 16,
    },
    generatedCodeText: {
        fontSize: 64,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 12,
    },
    generatedCodeExpiry: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 16,
        fontWeight: '600',
    },
    floatingActionBtn: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        borderRadius: 30,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: BLUE_PRIMARY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    fabGradient: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrScannerContainer: {
        width: width * 0.8,
        aspectRatio: 1,
        borderRadius: 20,
        overflow: 'hidden',
        marginTop: 30,
        backgroundColor: '#000',
    },
    qrOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrOverlayText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
    },
    qrScanBtn: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    qrScanBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
