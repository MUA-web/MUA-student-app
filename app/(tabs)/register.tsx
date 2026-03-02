import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    TextInput,
    Dimensions,
    Animated,
    Easing,
    ScrollView,
    Image,
    StatusBar,
    Modal,
    Pressable,
    FlatList,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabase';

export default function AttendanceMarkingScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [regNumber, setRegNumber] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [levelId, setLevelId] = useState('');
    const [departmentName, setDepartmentName] = useState('');
    const [levelLabel, setLevelLabel] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);

    const [attendanceCode, setAttendanceCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [codeCountdown, setCodeCountdown] = useState(60);
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [courses, setCourses] = useState<any[]>([]);
    const [isPasscodeModalVisible, setIsPasscodeModalVisible] = useState(false);
    const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [locationGranted, setLocationGranted] = useState<boolean | null>(null); // null = checking

    // Scanning overlay state
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error'>('scanning');

    // Animated values for the scanning overlay
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulse2Anim = useRef(new Animated.Value(1)).current;
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const iconOpacityAnim = useRef(new Animated.Value(1)).current;
    const overlayOpacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchProfileAndCourses();
        checkBiometrics();
        fetchUnreadCount();
        requestLocationEarly();
    }, []);

    // Request location permission early so student enables GPS before attempting attendance
    const requestLocationEarly = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationGranted(status === 'granted');
            if (status !== 'granted') {
                Alert.alert(
                    '📍 Location Required',
                    'This app needs your GPS location to verify you are in class before marking attendance. Please enable Location permission in your device settings.',
                    [{ text: 'OK', style: 'default' }]
                );
            }
        } catch (e) {
            setLocationGranted(false);
        }
    };


    // Rotating code: regenerate every minute, countdown every second
    useEffect(() => {
        if (!selectedCourse) return;

        const regenerate = () => {
            const code = generateMinuteCode(selectedCourse.code);
            setGeneratedCode(code);
            const now = new Date();
            setCodeCountdown(60 - now.getSeconds());
        };

        regenerate(); // run immediately

        const interval = setInterval(() => {
            const now = new Date();
            const secondsLeft = 60 - now.getSeconds();
            setCodeCountdown(secondsLeft);
            if (secondsLeft === 60) {
                // A new minute just started — regenerate code
                const code = generateMinuteCode(selectedCourse.code);
                setGeneratedCode(code);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedCourse]);

    // Start animations when scanning overlay is visible
    useEffect(() => {
        if (isScanning) {
            // Fade in overlay
            Animated.timing(overlayOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

            // Pulsing ring 1
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                ])
            ).start();

            // Pulsing ring 2 (offset)
            setTimeout(() => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulse2Anim, { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        Animated.timing(pulse2Anim, { toValue: 1, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                    ])
                ).start();
            }, 400);

            // Scanning line moving up and down
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
                    Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
                ])
            ).start();
        } else {
            // Reset
            pulseAnim.setValue(1);
            pulse2Anim.setValue(1);
            scanLineAnim.setValue(0);
            overlayOpacityAnim.setValue(0);
        }
    }, [isScanning]);

    const isWithinSchedule = (sessionDay: string, startTimeStr: string, durationStr: string) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const now = new Date();
        const currentDay = days[now.getDay()];

        // 1. STRICT day check — block if no schedule set OR wrong day
        if (!sessionDay) {
            return { valid: false, reason: 'This course has no scheduled day set. Ask your admin to configure the course schedule.' };
        }
        if (sessionDay.toLowerCase() !== currentDay.toLowerCase()) {
            return { valid: false, reason: `This course is scheduled for ${sessionDay}, but today is ${currentDay}.` };
        }

        // 2. STRICT time check — block if no start time set
        if (!startTimeStr) {
            return { valid: false, reason: 'This course has no scheduled time set. Ask your admin to configure the course schedule.' };
        }

        // 3. Parse startTimeStr (e.g. "10:00 AM")
        const match = startTimeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
        if (!match) {
            return { valid: false, reason: 'The course schedule time format is invalid. Contact your admin.' };
        }

        try {
            let startHours = parseInt(match[1]);
            const startMinutes = parseInt(match[2] || '0');
            const ampm = match[3].toUpperCase();

            if (ampm === 'PM' && startHours < 12) startHours += 12;
            if (ampm === 'AM' && startHours === 12) startHours = 0;

            const startDate = new Date(now);
            startDate.setHours(startHours, startMinutes, 0, 0);

            // Duration is like "2 Hours" - extract number
            const duration = parseInt(durationStr) || 1;
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + duration);

            const isValid = now >= startDate && now <= endDate;

            if (!isValid) {
                const endStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return {
                    valid: false,
                    reason: now < startDate
                        ? `Attendance hasn't started yet. It opens at ${startTimeStr}.`
                        : `Attendance session has ended. It was available until ${endStr}.`
                };
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, reason: 'Could not validate the course schedule. Contact your admin.' };
        }
    };

    // Haversine formula to calculate distance between two coordinates in meters
    const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Radius of the earth in m
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in meters
    };

    const fetchProfileAndCourses = async () => {
        setIsLoadingProfile(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Get student profile
                const { data: student } = await supabase
                    .from('students')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (student) {
                    setFullName(student.full_name);
                    setRegNumber(student.registration_number);
                    setDepartmentId(student.department_id);
                    setLevelId(student.level_id);
                    setDepartmentName(student.department || '');
                    setLevelLabel(student.level || '');

                    // Fetch courses matching student's department and level
                    // Combine ID-based and name-based filtering for maximum compatibility
                    let query = supabase.from('courses').select('*, departments!inner(name), levels!inner(label)');

                    if (student.department_id && student.level_id) {
                        query = query.eq('department_id', student.department_id)
                            .eq('level_id', student.level_id);
                    } else {
                        // Fallback for legacy data - filter by the names in student profile
                        console.warn('Student profile missing IDs, using name-based filtering fallback.');
                        query = query.eq('departments.name', student.department)
                            .eq('levels.label', student.level);
                    }

                    const { data: coursesData, error: coursesError } = await query;

                    if (coursesError) {
                        console.error('Error fetching courses:', coursesError);
                    }

                    setCourses(coursesData || []);

                    if (coursesData && coursesData.length > 0) {
                        // AUTO-SELECT active course
                        const activeCourse = coursesData.find(c => {
                            const check = isWithinSchedule(c.session_day, c.session_time, c.duration);
                            return check.valid;
                        });

                        if (activeCourse) {
                            setSelectedCourse(activeCourse);
                            generateDailyCodeForCourse(activeCourse.code);
                        } else {
                            // Default to first if none active
                            setSelectedCourse(coursesData[0]);
                            generateDailyCodeForCourse(coursesData[0].code);
                        }
                    } else {
                        setSelectedCourse(null);
                        setGeneratedCode('');
                    }

                    // 3. Fetch today's attendance for this student to prevent duplicates
                    const today = new Date().toISOString().split('T')[0];
                    const { data: attData } = await supabase
                        .from('attendance')
                        .select('course_code')
                        .eq('registration_number', student.registration_number)
                        .eq('date', today);

                    setTodayAttendance(attData || []);
                } else {
                    console.log('Student profile not found for ID:', session.user.id);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    // Generate a pseudo-random 4-digit code based on course code + date + current minute.
    // This ensures all students on the same course see the SAME rotating code every minute.
    const generateMinuteCode = (courseCode: string, minuteOffset = 0): string => {
        if (!courseCode) return '';
        const now = new Date();
        now.setMinutes(now.getMinutes() + minuteOffset);
        const dateStr = now.toISOString().split('T')[0];
        const minuteStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        const seedStr = `${courseCode}-${dateStr}-${minuteStr}`;

        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const code = (Math.abs(hash) % 10000).toString().padStart(4, '0');
        return code;
    };

    // Keep generateDailyCodeForCourse for backwards compatibility (used on course select)
    const generateDailyCodeForCourse = (courseCode: string) => {
        const code = generateMinuteCode(courseCode);
        setGeneratedCode(code);
    };

    const checkBiometrics = async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(hasHardware);
        setIsBiometricEnrolled(isEnrolled);
    };

    const SUCCESS_GREEN = '#22C55E';
    const BLUE_PRIMARY = '#2563EB';
    const SLATE_GRAY = '#64748B';

    const isAlreadyMarked = todayAttendance.some(a => a.course_code === selectedCourse?.code);

    const logAttendanceToBoth = async (isBiometric: boolean, code?: string) => {
        if (!selectedCourse) {
            Alert.alert('Error', 'No course selected.');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in to mark attendance.');

            // --- Daily Limit Check ---
            const alreadyMarked = todayAttendance.some(a => a.course_code === selectedCourse?.code);
            if (alreadyMarked) {
                Alert.alert('Already Marked', 'You have already marked attendance for this course today.');
                return;
            }
            // -------------------------

            // --- Schedule Check ---
            const scheduleCheck = isWithinSchedule(
                selectedCourse.session_day,
                selectedCourse.session_time,
                selectedCourse.duration
            );
            if (!scheduleCheck.valid) {
                Alert.alert(
                    'No Active Session',
                    scheduleCheck.reason || 'There is no scheduled class for this course right now.'
                );
                return;
            }
            // ----------------------

            // --- Geofencing Check ---
            if (selectedCourse.latitude && selectedCourse.longitude) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Location permission is required to verify you are in class.');
                    return;
                }

                let location = null;
                try {
                    // Use a timeout to avoid waiting forever for a fresh fix
                    const locationPromise = Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High
                    });

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 5000)
                    );

                    // Race the location against a 5-second timeout
                    location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
                } catch (e) {
                    // Fallback to last known if fresh fails or times out
                    location = await Location.getLastKnownPositionAsync();
                }

                if (!location) {
                    Alert.alert('Location Error', 'Could not determine your location. Please ensure GPS is enabled and try again.');
                    return;
                }

                const distanceMeters = getDistanceFromLatLonInMeters(
                    location.coords.latitude,
                    location.coords.longitude,
                    selectedCourse.latitude,
                    selectedCourse.longitude
                );

                const allowedRadius = selectedCourse.radius_meters || 100; // Default to 100m for better consistency

                if (distanceMeters > allowedRadius) {
                    Alert.alert(
                        'Out of Range',
                        `You are approximately ${Math.round(distanceMeters)}m away from the class location. You must be within ${allowedRadius}m to mark attendance.`
                    );
                    return;
                }
            }
            // ------------------------

            const method = isBiometric ? 'Self (Fingerprint)' : `Self (Code: ${code})`;

            // 1. Log to attendance_logs (Supabase Direct)
            const { error: logError } = await supabase
                .from('attendance_logs')
                .insert({
                    student_id: user.id,
                    course_id: selectedCourse.id,
                    status: 'Present',
                    marked_by: method,
                    timestamp: new Date().toISOString(),
                });
            if (logError) throw logError;

            // 2. Log to attendance (Backend Compatibility)
            const { error: attError } = await supabase
                .from('attendance')
                .insert({
                    name: fullName,
                    date: new Date().toISOString().split('T')[0],
                    course_code: selectedCourse.code,
                    registration_number: regNumber,
                    department: departmentName, // Use text name, not UUID
                    level: levelLabel,          // Use text label, not UUID
                    method: isBiometric ? 'Fingerprint' : 'Passcode'
                });

            if (attError) throw attError;

            // Update local state immediately so UI reflects the change without a refetch
            setTodayAttendance(prev => [...prev, { course_code: selectedCourse.code }]);

            setIsSuccess(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
                setIsSuccess(false);
                setAttendanceCode('');
                setIsPasscodeModalVisible(false);
            }, 3000);
        } catch (error: any) {
            console.error('Attendance logging error:', error);
            Alert.alert('Error', error.message || 'Failed to mark attendance.');
        } finally {
            setIsSaving(false);
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

    const handleFingerprintAttendance = async () => {
        if (!isBiometricSupported || !isBiometricEnrolled) {
            Alert.alert('Biometrics Unavailable', 'Your device does not support or have biometrics enrolled.');
            return;
        }

        // Show our custom scanning overlay first
        setScanStatus('scanning');
        setIsScanning(true);

        // Brief dramatic pause before calling native prompt
        await new Promise(resolve => setTimeout(resolve, 850));

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Place your finger to mark attendance',
                disableDeviceFallback: true,
            });

            if (result.success) {
                setScanStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await logAttendanceToBoth(true);
                // Keep success state visible briefly
                await new Promise(resolve => setTimeout(resolve, 1200));
                setIsScanning(false);
            } else {
                setScanStatus('error');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                await new Promise(resolve => setTimeout(resolve, 1000));
                setIsScanning(false);
            }
        } catch (err: any) {
            setScanStatus('error');
            await new Promise(resolve => setTimeout(resolve, 800));
            setIsScanning(false);
            Alert.alert('Auth Failed', err.message || 'Biometric authentication failed.');
        }
    };

    const handlePasscodeSubmit = async (code: string) => {
        if (code.length < 4) return;

        if (!selectedCourse) {
            Alert.alert('Error', 'No course selected.');
            return;
        }

        const currentCode = generateMinuteCode(selectedCourse.code);
        // Also accept previous minute's code as a 10-second grace period
        const prevCode = generateMinuteCode(selectedCourse.code, -1);
        const secondsLeft = 60 - new Date().getSeconds();
        const withinGrace = secondsLeft > 50; // first 10 seconds of a new minute

        if (code === currentCode || (withinGrace && code === prevCode)) {
            await logAttendanceToBoth(false, code);
        } else {
            Alert.alert('Invalid Code', 'The passcode you entered is incorrect. Please check the current code and try again.');
            setAttendanceCode('');
        }
    };


    return (
        <View style={styles.baseContainer}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                bounces={false}
                showsVerticalScrollIndicator={false}
            >
                <SafeAreaView edges={['top']}>
                    <View style={styles.referenceHeader}>
                        <View style={styles.refHeaderLeft}>
                            <View style={[styles.refAvatar, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="school" size={24} color="#2563EB" />
                            </View>
                            <View>
                                <Text style={styles.refWelcome}>Mark Attendance</Text>
                                <Text style={styles.refName}>{fullName || 'Student'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => router.back()} style={styles.refNotificationBtn}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <View style={[styles.formBody, { marginTop: 10 }]}>
                    {locationGranted === false && (
                        <View style={styles.locationWarningBanner}>
                            <Ionicons name="location" size={20} color="#92400E" />
                            <Text style={styles.locationWarningText}>
                                Location is required for attendance. Please enable GPS in your device settings.
                            </Text>
                            <TouchableOpacity onPress={requestLocationEarly} style={styles.retryLocationBtn}>
                                <Text style={styles.retryLocationText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.modernProgressCard}>
                        <View style={styles.formSection}>
                            <Text style={styles.modernSectionTitle}>1. Assigned Course</Text>
                            <Text style={styles.modernProgSub}>Course for attendance (Auto-selected)</Text>

                            {isLoadingProfile ? (
                                <ActivityIndicator color={BLUE_PRIMARY} style={{ marginTop: 10 }} />
                            ) : courses.length > 0 ? (
                                <TouchableOpacity
                                    style={[styles.modernCourseCard, { marginTop: 16, backgroundColor: '#EFF6FF', borderColor: BLUE_PRIMARY }]}
                                    onPress={() => {
                                        Alert.alert(
                                            'Select Course',
                                            'Choose a course for attendance:',
                                            (courses.map(c => ({
                                                text: `${c.code} - ${c.name}`,
                                                onPress: () => setSelectedCourse(c)
                                            })) as any[]).concat([{ text: 'Cancel', style: 'cancel' }])
                                        );
                                    }}
                                >
                                    <View style={styles.modernCourseRow}>
                                        <View style={[styles.modernCourseIconBox, { backgroundColor: BLUE_PRIMARY }]}>
                                            <Ionicons name="book" size={24} color="#FFF" />
                                        </View>
                                        <View style={styles.modernCourseInfo}>
                                            <Text style={styles.modernCourseName}>{selectedCourse?.name || 'Loading...'}</Text>
                                            <Text style={styles.modernProgSub}>{selectedCourse?.code || 'Please select'}</Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={20} color={BLUE_PRIMARY} />
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.enrolledSuccessBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', marginTop: 16 }]}>
                                    <Ionicons name="alert-circle" size={24} color="#EF4444" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.enrolledSuccessTitle, { color: '#991B1B' }]}>No Courses Assigned</Text>
                                        <Text style={[styles.enrolledSuccessSub, { color: '#B91C1C' }]}>
                                            No courses found for your department and level.
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* --- Rotating Live Attendance Code --- */}
                            {selectedCourse && generatedCode && (
                                <View style={{ marginTop: 24, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 16, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#3B82F6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Live Attendance Code</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {generatedCode.split('').map((digit: string, idx: number) => (
                                            <View key={idx} style={{ width: 48, height: 56, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
                                                <Text style={{ fontSize: 28, fontWeight: '800', color: '#1E40AF' }}>{digit}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Countdown bar */}
                                    <View style={{ width: '100%', marginTop: 14, gap: 6 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Code refreshes in</Text>
                                            <Text style={{
                                                fontSize: 11, fontWeight: '800',
                                                color: codeCountdown <= 10 ? '#DC2626' : codeCountdown <= 20 ? '#D97706' : '#2563EB'
                                            }}>{codeCountdown}s</Text>
                                        </View>
                                        <View style={{ height: 6, backgroundColor: '#DBEAFE', borderRadius: 3, overflow: 'hidden' }}>
                                            <View style={{
                                                height: 6,
                                                borderRadius: 3,
                                                width: `${(codeCountdown / 60) * 100}%`,
                                                backgroundColor: codeCountdown <= 10 ? '#DC2626' : codeCountdown <= 20 ? '#D97706' : '#2563EB'
                                            }} />
                                        </View>
                                    </View>

                                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                                        Code changes every minute for {selectedCourse.code}
                                    </Text>
                                </View>
                            )}
                            {/* ----------------------------------------------------------------- */}

                            <Text style={[styles.modernSectionTitle, { marginTop: 24 }]}>2. Biometric Scan</Text>
                            <Text style={styles.modernProgSub}>Tap to verify your identity</Text>

                            <TouchableOpacity
                                style={[
                                    styles.biometricBtn,
                                    (isSuccess || !selectedCourse || todayAttendance.some(a => a.course_code === selectedCourse?.code)) && styles.biometricBtnLocked,
                                    { marginTop: 16, marginBottom: 24 }
                                ]}
                                onPress={handleFingerprintAttendance}
                                disabled={isSaving || isSuccess || !selectedCourse || todayAttendance.some(a => a.course_code === selectedCourse?.code)}
                            >
                                <View style={styles.biometricPlaceholder}>
                                    <View style={[styles.modernActionIconBox, { backgroundColor: isAlreadyMarked ? '#F1F5F9' : '#EFF6FF' }]}>
                                        <Ionicons name="finger-print" size={32} color={isAlreadyMarked ? '#94A3B8' : '#2563EB'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.modernActionTitle, isAlreadyMarked && { color: '#94A3B8' }]}>Biometric Secure Link</Text>
                                        <Text style={styles.modernProgSub}>
                                            {isAlreadyMarked ? 'Identity Verified Today' : (!selectedCourse ? 'Please select a course first' : 'Tap to authenticate')}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isAlreadyMarked ? '#CBD5E1' : '#64748B'} />
                                </View>
                                {isSuccess && (
                                    <View style={[styles.retakeBadge, { backgroundColor: SUCCESS_GREEN }]}>
                                        <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                                        <Text style={styles.retakeText}>SUCCESS</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.modernSectionTitle}>3. Security Passcode</Text>
                            <Text style={styles.modernProgSub}>Alternative verification method</Text>

                            <TouchableOpacity
                                style={[
                                    styles.modernCourseCard,
                                    { marginTop: 16, backgroundColor: '#F8FAFC' },
                                    (todayAttendance.some(a => a.course_code === selectedCourse?.code)) && { opacity: 0.6 }
                                ]}
                                onPress={() => {
                                    if (!selectedCourse) {
                                        Alert.alert('Course Required', 'Please select a course first');
                                        return;
                                    }
                                    if (todayAttendance.some(a => a.course_code === selectedCourse?.code)) {
                                        Alert.alert('Already Marked', 'You have already marked attendance for this course today.');
                                        return;
                                    }
                                    setIsPasscodeModalVisible(true);
                                }}
                                disabled={isSaving || isSuccess || !selectedCourse || todayAttendance.some(a => a.course_code === selectedCourse?.code)}
                            >
                                <View style={styles.modernCourseRow}>
                                    <View style={[styles.modernCourseIconBox, { backgroundColor: isAlreadyMarked ? '#F1F5F9' : '#FFFFFF' }]}>
                                        <Ionicons name="keypad" size={24} color={isAlreadyMarked ? '#94A3B8' : '#2563EB'} />
                                    </View>
                                    <View style={[styles.modernCourseInfo, { flex: 1 }]}>
                                        <Text style={[styles.infoLabel, { color: isAlreadyMarked ? '#94A3B8' : '#64748B' }]}>PASSCODE ACCESS</Text>
                                        <Text style={[styles.modernCourseName, { fontSize: 18 }, isAlreadyMarked && { color: '#94A3B8' }]}>••••</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isAlreadyMarked ? '#CBD5E1' : '#64748B'} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.submitBtnLarge,
                            (isSaving || isSuccess || !selectedCourse || todayAttendance.some(a => a.course_code === selectedCourse?.code)) && { opacity: 0.6 }
                        ]}
                        onPress={handleFingerprintAttendance}
                        disabled={isSaving || isSuccess || !selectedCourse || todayAttendance.some(a => a.course_code === selectedCourse?.code)}
                    >
                        <LinearGradient
                            colors={isSuccess ? [SUCCESS_GREEN, SUCCESS_GREEN] : todayAttendance.some(a => a.course_code === selectedCourse?.code) ? ['#64748B', '#475569'] : ['#2563EB', '#1D4ED8']}
                            style={styles.submitGradient}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : isSuccess ? (
                                <>
                                    <Text style={styles.submitBtnText}>PRESENT</Text>
                                    <Ionicons name="checkmark-done-circle" size={22} color="#FFF" style={{ marginLeft: 8 }} />
                                </>
                            ) : todayAttendance.some(a => a.course_code === selectedCourse?.code) ? (
                                <>
                                    <Text style={styles.submitBtnText}>ALREADY MARKED TODAY</Text>
                                    <Ionicons name="calendar" size={22} color="#FFF" style={{ marginLeft: 8 }} />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.submitBtnText}>MARK ATTENDANCE</Text>
                                    <Ionicons name="finger-print" size={22} color="#FFF" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {isSuccess && (
                        <View style={styles.enrolledSuccessBox}>
                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                            <View>
                                <Text style={styles.enrolledSuccessTitle}>Attendance Marked!</Text>
                                <Text style={styles.enrolledSuccessSub}>Successfully recorded for {selectedCourse?.name || 'Current Course'}.</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Spacing for Tab Bar */}
                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Passcode Modal (Unified) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isPasscodeModalVisible}
                onRequestClose={() => setIsPasscodeModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsPasscodeModalVisible(false)}>
                    <Pressable style={styles.codeModal} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeaderStrip} />
                        <Text style={styles.codeModalTitle}>Security Passcode</Text>
                        <Text style={styles.codeModalSub}>Enter the 4-digit attendance code</Text>

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
                                                        if (newCode.length === 4) handlePasscodeSubmit(newCode);
                                                    }
                                                }
                                            }}
                                        >
                                            {key === 'back' ? (
                                                <Ionicons name="backspace" size={24} color="#64748B" />
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

            {/* === CUSTOM BIOMETRIC SCANNING OVERLAY === */}
            <Modal
                animationType="none"
                transparent={true}
                visible={isScanning}
                statusBarTranslucent={true}
            >
                <Animated.View style={[styles.scanOverlay, { opacity: overlayOpacityAnim }]}>
                    <LinearGradient
                        colors={
                            scanStatus === 'success' ? ['#064E3B', '#065F46', '#047857'] :
                                scanStatus === 'error' ? ['#450A0A', '#7F1D1D', '#991B1B'] :
                                    ['#020617', '#0F172A', '#0A1628']
                        }
                        style={styles.scanGradient}
                    >
                        {/* Top label */}
                        <View style={styles.scanHeader}>
                            <View style={styles.scanDotRow}>
                                <View style={[styles.scanDot, { backgroundColor: '#22C55E' }]} />
                                <View style={[styles.scanDot, { backgroundColor: '#EAB308' }]} />
                                <View style={[styles.scanDot, { backgroundColor: '#EF4444' }]} />
                            </View>
                            <Text style={styles.scanSystemLabel}>BIOMETRIC SECURITY SYSTEM</Text>
                        </View>

                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            {/* Outer pulsing ring 2 */}
                            <Animated.View style={[
                                styles.scanPulseRing2,
                                {
                                    transform: [{ scale: pulse2Anim }],
                                    opacity: pulse2Anim.interpolate({ inputRange: [1, 1.6], outputRange: [0.15, 0] }),
                                    borderColor:
                                        scanStatus === 'success' ? '#22C55E' :
                                            scanStatus === 'error' ? '#EF4444' : '#3B82F6'
                                }
                            ]} />

                            {/* Outer pulsing ring 1 */}
                            <Animated.View style={[
                                styles.scanPulseRing1,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    opacity: pulseAnim.interpolate({ inputRange: [1, 1.4], outputRange: [0.3, 0] }),
                                    borderColor:
                                        scanStatus === 'success' ? '#22C55E' :
                                            scanStatus === 'error' ? '#EF4444' : '#60A5FA'
                                }
                            ]} />

                            {/* Scanner box */}
                            <View style={[
                                styles.scannerBox,
                                scanStatus === 'success' && { borderColor: '#22C55E' },
                                scanStatus === 'error' && { borderColor: '#EF4444' },
                            ]}>
                                {/* Corner brackets */}
                                <View style={[styles.scanCorner, styles.scanCornerTL,
                                scanStatus === 'success' && { borderColor: '#22C55E' },
                                scanStatus === 'error' && { borderColor: '#EF4444' },
                                ]} />
                                <View style={[styles.scanCorner, styles.scanCornerTR,
                                scanStatus === 'success' && { borderColor: '#22C55E' },
                                scanStatus === 'error' && { borderColor: '#EF4444' },
                                ]} />
                                <View style={[styles.scanCorner, styles.scanCornerBL,
                                scanStatus === 'success' && { borderColor: '#22C55E' },
                                scanStatus === 'error' && { borderColor: '#EF4444' },
                                ]} />
                                <View style={[styles.scanCorner, styles.scanCornerBR,
                                scanStatus === 'success' && { borderColor: '#22C55E' },
                                scanStatus === 'error' && { borderColor: '#EF4444' },
                                ]} />

                                {/* Fingerprint icon */}
                                <Ionicons
                                    name={
                                        scanStatus === 'success' ? 'checkmark-circle' :
                                            scanStatus === 'error' ? 'close-circle' : 'finger-print'
                                    }
                                    size={80}
                                    color={
                                        scanStatus === 'success' ? '#22C55E' :
                                            scanStatus === 'error' ? '#EF4444' : '#60A5FA'
                                    }
                                />

                                {/* Animated scan line - only visible when scanning */}
                                {scanStatus === 'scanning' && (
                                    <Animated.View style={[
                                        styles.scanLine,
                                        {
                                            transform: [{
                                                translateY: scanLineAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [-55, 55]
                                                })
                                            }]
                                        }
                                    ]} />
                                )}
                            </View>

                            {/* Status text */}
                            <Text style={[
                                styles.scanStatusText,
                                scanStatus === 'success' && { color: '#22C55E' },
                                scanStatus === 'error' && { color: '#EF4444' },
                            ]}>
                                {scanStatus === 'success' ? 'IDENTITY VERIFIED' :
                                    scanStatus === 'error' ? 'SCAN FAILED' :
                                        'VERIFYING IDENTITY...'}
                            </Text>
                            <Text style={styles.scanSubText}>
                                {scanStatus === 'success' ? 'Attendance marked successfully' :
                                    scanStatus === 'error' ? 'Please try again' :
                                        'Place your finger on the sensor'}
                            </Text>

                            {/* Loading dots when scanning */}
                            {scanStatus === 'scanning' && (
                                <View style={styles.scanDotsContainer}>
                                    {[0, 1, 2].map(i => (
                                        <Animated.View key={i} style={[
                                            styles.scanningDot,
                                            {
                                                opacity: scanLineAnim.interpolate({
                                                    inputRange: [0, 0.33 * i, 0.33 * (i + 1), 1],
                                                    outputRange: [0.3, 1, 0.3, 0.3],
                                                    extrapolate: 'clamp'
                                                })
                                            }
                                        ]} />
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Bottom secure badge */}
                        <View style={styles.scanFooter}>
                            <Ionicons name="shield-checkmark" size={14} color="#475569" />
                            <Text style={styles.scanFooterText}>256-bit Encrypted · Secure · Private</Text>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </Modal>
        </View>
    );
}

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 600);

const styles = StyleSheet.create({
    baseContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
        justifyContent: 'center',
    },
    formBody: {
        paddingHorizontal: 24,
    },
    formSection: {
        marginBottom: 24,
    },
    biometricBtn: {
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    biometricBtnLocked: {
        opacity: 0.8,
        backgroundColor: '#F1F5F9',
        borderStyle: 'solid',
        borderColor: '#CBD5E1',
    },
    biometricPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    retakeBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    retakeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
    submitBtnLarge: {
        marginTop: 24,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    submitGradient: {
        height: 68,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1,
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.danger,
    },
    locationWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    locationWarningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
        fontWeight: '600',
        marginLeft: 8,
    },
    retryLocationBtn: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    retryLocationText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    // Dashboard Consistent Styles
    referenceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 24,
        marginBottom: 10,
    },
    refHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    refAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    refWelcome: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    refName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    refNotificationBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    modernProgressCard: {
        padding: 24,
        borderRadius: 28,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    modernSectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    modernProgSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    modernActionIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modernActionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1E293B',
    },
    refNotificationDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#FFF',
        zIndex: 1,
    },
    modernCourseCard: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    modernCourseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    modernCourseIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modernCourseInfo: {
        flex: 1,
    },
    modernCourseName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
    },
    enrolledSuccessBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        padding: 20,
        borderRadius: 24,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 16,
    },
    enrolledSuccessTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#065F46',
    },
    enrolledSuccessSub: {
        fontSize: 12,
        color: '#047857',
        fontWeight: '600',
    },
    // Status Badge
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    codeModal: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 32,
        paddingBottom: 48,
        alignItems: 'center',
    },
    modalHeaderStrip: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        marginBottom: 24,
    },
    codeModalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
    },
    codeModalSub: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 6,
        marginBottom: 32,
        textAlign: 'center',
    },
    codeInputsContainer: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 40,
    },
    codeInputCell: {
        width: 60,
        height: 70,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#F1F5F9',
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeInputCellActive: {
        borderColor: '#2563EB',
        backgroundColor: '#FFF',
    },
    codeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#0F172A',
    },
    keypad: {
        width: '100%',
        gap: 12,
    },
    keypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    key: {
        flex: 1,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0F172A',
    },
    // ===== SCANNING OVERLAY STYLES =====
    scanOverlay: {
        flex: 1,
    },
    scanGradient: {
        flex: 1,
        paddingTop: 60,
        paddingBottom: 40,
    },
    scanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    scanDotRow: {
        flexDirection: 'row',
        gap: 6,
    },
    scanDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    scanSystemLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 2,
    },
    scanPulseRing1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 2,
        borderColor: '#60A5FA',
    },
    scanPulseRing2: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        borderWidth: 1.5,
        borderColor: '#3B82F6',
    },
    scannerBox: {
        width: 140,
        height: 140,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E40AF',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    scanCorner: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderColor: '#60A5FA',
        borderWidth: 3,
    },
    scanCornerTL: {
        top: -1,
        left: -1,
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderTopLeftRadius: 8,
    },
    scanCornerTR: {
        top: -1,
        right: -1,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderTopRightRadius: 8,
    },
    scanCornerBL: {
        bottom: -1,
        left: -1,
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomLeftRadius: 8,
    },
    scanCornerBR: {
        bottom: -1,
        right: -1,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomRightRadius: 8,
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 8,
    },
    scanStatusText: {
        marginTop: 32,
        fontSize: 18,
        fontWeight: '900',
        color: '#E2E8F0',
        letterSpacing: 2,
    },
    scanSubText: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
    },
    scanDotsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 20,
    },
    scanningDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
    scanFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 24,
    },
    scanFooterText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
