import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
    Image,
    StatusBar,
    Modal,
    Pressable,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import Card from '../../components/Card';
import AppHeader from '../../components/AppHeader';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const { width: windowWidth, height } = Dimensions.get('window');
const width = Math.min(windowWidth, 600);
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';
const SLATE_LIGHT = '#F8FAFC';
const YELLOW_GOLD = '#FBDF4B';

export default function Dashboard() {
    const router = useRouter();
    const [role, setRole] = useState<'admin' | 'student'>('student');
    const [userName, setUserName] = useState('');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [stats, setStats] = useState({
        registered: 0,
        present: 0,
        late: 0,
        absent: 0,
        attendanceRate: 0,
        personalRate: 0,
    });
    const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
    const [studentCourses, setStudentCourses] = useState<any[]>([]);
    const [studentBooks, setStudentBooks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [ongoingCourse, setOngoingCourse] = useState<any>(null);

    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 4000 }),
            -1,
            false
        );
    }, []);

    const animatedBorderStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }],
        };
    });

    useEffect(() => {
        fetchUserProfile();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            fetchUnreadCount();
            // Re-fetch dashboard data every time screen comes into focus
            // so attendance progress updates after student marks attendance
            supabase.auth.getSession().then(({ data: { session }, error }) => {
                if (error) {
                    if (error.message.includes('refresh_token') || error.message.includes('Invalid Refresh Token')) {
                        supabase.auth.signOut().then(() => router.replace('/(auth)/login'));
                    }
                    return;
                }
                if (session?.user) {
                    const userRole = session.user.user_metadata?.role || 'student';
                    fetchDashboardData(userRole, session.user.user_metadata);
                }
            });
        }, [])
    );

    const fetchUserProfile = async () => {
        try {
            const { data, error: sessionError } = await supabase.auth.getSession();
            const session = data?.session;

            if (sessionError) {
                console.error('Session error:', sessionError.message);
                if (sessionError.message.includes('refresh_token') || sessionError.message.includes('Invalid Refresh Token')) {
                    await supabase.auth.signOut();
                    router.replace('/(auth)/login');
                }
                return;
            }

            if (session) {
                const user = session.user;
                const userRole = user.user_metadata?.role || 'student';
                setRole(userRole);
                setUserName(user.user_metadata?.full_name || 'User');
                setUserProfile(user.user_metadata);
                // Trigger dashboard data fetch without awaiting all of it for the main UI to show up
                fetchDashboardData(userRole, user.user_metadata);
            } else {
                router.replace('/(auth)/login');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            // Set loading to false as soon as user profile (role/name) is determined
            setIsLoading(false);
        }
    };

    const fetchDashboardData = async (userRole: 'admin' | 'student', profile: any) => {
        try {
            if (userRole === 'admin') {
                const today = new Date().toISOString().split('T')[0];

                // Parallelize fetching registered count and attendance stats
                const [regResult, attResult] = await Promise.all([
                    supabase.from('faces').select('*', { count: 'exact', head: true }),
                    supabase
                        .from('attendance')
                        .select('*')
                        .eq('date', today)
                        .order('created_at', { ascending: false })
                ]);

                const regCount = regResult.count || 0;
                const dailyAttendance = attResult.data || [];
                const presentCount = dailyAttendance.length;

                setStats(prev => ({
                    ...prev,
                    registered: regCount,
                    present: presentCount,
                    absent: Math.max(0, regCount - presentCount),
                    attendanceRate: regCount ? Math.round((presentCount / regCount) * 100) : 0
                }));
                setRecentAttendance(dailyAttendance.slice(0, 5));
            } else {
                // Student stats
                let regNo = profile?.reg_no;
                let deptName = profile?.department;
                let levelLabel = profile?.level;
                let deptId = null;
                let lvlId = null;

                // 1. Try to get student record for better IDs
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const { data: student } = await supabase
                            .from('students')
                            .select('*')
                            .eq('id', session.user.id)
                            .maybeSingle();

                        if (student) {
                            regNo = student.registration_number;
                            deptName = student.department || deptName;
                            levelLabel = student.level || levelLabel;
                            deptId = student.department_id;
                            lvlId = student.level_id;
                        }
                    }
                } catch (err) {
                    console.log('Error fetching student record, using metadata:', err);
                }

                if (regNo) {
                    try {
                        // 2. Fetch courses with optimized ID filtering + logic join fallback
                        let coursesQuery = supabase.from('courses').select('*, departments!inner(name), levels!inner(label)');
                        if (deptId && lvlId) {
                            coursesQuery = coursesQuery.eq('department_id', deptId).eq('level_id', lvlId);
                        } else {
                            coursesQuery = coursesQuery.eq('departments.name', deptName).eq('levels.label', levelLabel);
                        }

                        // 3. Fetch books with similar logic
                        let booksQuery = supabase.from('books').select('*');
                        if (deptName && levelLabel) {
                            booksQuery = booksQuery.eq('department', deptName).eq('level', levelLabel);
                        }

                        const [attResult, coursesResult, booksResult] = await Promise.all([
                            supabase
                                .from('attendance')
                                .select('*')
                                .eq('registration_number', regNo),
                            coursesQuery,
                            booksQuery
                        ]);

                        const attendanceRecords = attResult.data || [];
                        const allCourses = coursesResult.data || [];
                        const allBooks = booksResult.data || [];

                        // Map courses with their specific attendance count
                        const enrichedCourses = allCourses.map(course => {
                            const courseAttendedCount = attendanceRecords.filter((r: any) => r.course_code === course.code).length;
                            return {
                                ...course,
                                attended: courseAttendedCount,
                                percentage: Math.round((courseAttendedCount / (course.total_sessions || 40)) * 100)
                            };
                        });

                        setStudentCourses(enrichedCourses);
                        setStudentBooks(allBooks);
                        fetchUnreadCount();

                        const totalAttended = attendanceRecords.length;
                        const totalSessionsSum = allCourses.reduce((sum, c) => sum + (c.total_sessions || 40), 0) || 1;

                        setStats(prev => ({
                            ...prev,
                            personalRate: Math.min(100, Math.round((totalAttended / totalSessionsSum) * 100))
                        }));

                        // Find ongoing course
                        const activeCourse = enrichedCourses.find(course => {
                            const schedule = isWithinSchedule(course.session_day, course.session_time, course.duration);
                            return schedule.valid;
                        });
                        setOngoingCourse(activeCourse || null);
                    } catch (e) {
                        console.error('Error fetching student attendance details:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Error in fetchDashboardData:', error);
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

    const toggleRole = () => setRole(prev => prev === 'admin' ? 'student' : 'admin');
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('Logout error:', error);
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

        if (!startTimeStr) return { valid: false, isToday: true, isUpcoming: false, reason: "No start time specified for today's session." };

        const match = startTimeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
        if (!match) return { valid: false, isToday: true, isUpcoming: false, reason: "Invalid start time format." };

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

    const menuItems = [
        { id: '1', title: 'Attendance Log', icon: 'list-outline', route: '/(admin)/attendance-log' },
        { id: '2', title: 'Student Management', icon: 'people-outline', route: '/(admin)/students' },
        { id: '3', title: 'Department Settings', icon: 'business-outline', route: '/(admin)/departments' },
        { id: '4', title: 'Course Creation', icon: 'book-outline', route: '/(admin)/courses' },
        { id: '5', title: 'Level Configuration', icon: 'layers-outline', route: '/(admin)/levels' },
        { id: '6', title: 'Admin Settings', icon: 'settings-outline', route: '/(admin)/settings' },
    ];

    const renderMenu = () => (
        <Modal
            visible={isMenuOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={toggleMenu}
        >
            <Pressable style={styles.menuOverlay} onPress={toggleMenu}>
                <View style={styles.menuDrawer}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.menuHeader}>
                            <Image
                                source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
                                style={styles.menuAvatar}
                            />
                            <View>
                                <Text style={styles.menuAdminName}>{userName}</Text>
                                <Text style={styles.menuAdminRole}>{role === 'admin' ? 'System Administrator' : 'Student Account'}</Text>
                            </View>
                            <TouchableOpacity onPress={toggleMenu} style={styles.closeMenuBtn}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuDivider} />

                        <ScrollView style={styles.menuItemsList}>
                            {menuItems.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.menuItem}
                                    onPress={() => {
                                        toggleMenu();
                                        router.push(item.route as any);
                                    }}
                                >
                                    <View style={styles.menuItemIconBox}>
                                        <Ionicons name={item.icon as any} size={22} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.menuItemText}>{item.title}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={Colors.inactive} />
                                </TouchableOpacity>
                            ))}

                            <View style={[styles.menuDivider, { marginHorizontal: 0, marginVertical: 12 }]} />

                            <TouchableOpacity onPress={() => { toggleMenu(); toggleRole(); }} style={styles.menuItem}>
                                <View style={[styles.menuItemIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.08)' }]}>
                                    <Ionicons name="swap-horizontal-outline" size={22} color="#0891B2" />
                                </View>
                                <Text style={styles.menuItemText}>Switch to {role === 'admin' ? 'Student' : 'Admin'} Mode</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.menuFooter}>
                            <TouchableOpacity style={styles.modernLogoutBtn} onPress={async () => { await supabase.auth.signOut(); router.replace('/(auth)/login'); }}>
                                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                                <Text style={styles.modernLogoutText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Pressable>
        </Modal>
    );



    const renderAdminView = () => (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.adminHeroNew}
            >
                    <View style={styles.adminHeroTop}>
                        <View>
                            <Text style={styles.adminSystemName}>SYSTEM ADMINISTRATION</Text>
                            <Text style={styles.adminStatusTitle}>Control Dashboard</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={handleLogout} style={[styles.adminProfileBtnNew, { backgroundColor: '#FFFFFF', borderColor: '#F1F5F9' }]}>
                                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleMenu} style={styles.adminProfileBtnNew}>
                                <Ionicons name="apps" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.adminStatRowNew}>
                        <View style={styles.adminStatItemNew}>
                            <Text style={styles.adminStatValNew}>{stats.registered}</Text>
                            <Text style={styles.adminStatLabNew}>Registry</Text>
                        </View>
                        <View style={styles.adminStatDivider} />
                        <View style={styles.adminStatItemNew}>
                            <Text style={[styles.adminStatValNew, { color: '#10B981' }]}>{stats.present}</Text>
                            <Text style={styles.adminStatLabNew}>Active</Text>
                        </View>
                        <View style={styles.adminStatDivider} />
                        <View style={styles.adminStatItemNew}>
                            <Text style={[styles.adminStatValNew, { color: '#EF4444' }]}>{stats.absent}</Text>
                            <Text style={styles.adminStatLabNew}>Absence</Text>
                        </View>
                        <View style={styles.adminStatDivider} />
                        <View style={styles.adminStatItemNew}>
                            <Text style={[styles.adminStatValNew, { color: '#F59E0B' }]}>{stats.attendanceRate}%</Text>
                            <Text style={styles.adminStatLabNew}>Rate</Text>
                        </View>
                    </View>
            </LinearGradient>

            <View style={styles.adminContentBodyNew}>
                <View style={styles.overviewHeader}>
                    <Text style={styles.modernSectionTitle}>System Command</Text>
                    <View style={styles.inlineBadge}>
                        <Text style={styles.inlineBadgeText}>Quick Access</Text>
                    </View>
                </View>

                <View style={styles.adminActionsGridNew}>
                    {[
                        { label: 'Attendance', icon: 'list', color: '#6366F1', route: '/(admin)/attendance-log' },
                        { label: 'Students', icon: 'people', color: '#8B5CF6', route: '/(admin)/students' },
                        { label: 'Courses', icon: 'book', color: '#10B981', route: '/(admin)/courses' },
                        { label: 'Settings', icon: 'settings-2', color: '#F59E0B', route: '/(admin)/settings' },
                    ].map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.adminActionCardNew}
                            onPress={() => router.push(item.route as any)}
                        >
                            <View style={[styles.adminActionIconNew, { backgroundColor: item.color + '15' }]}>
                                <Ionicons name={item.icon as any} size={24} color={item.color} />
                            </View>
                            <Text style={styles.adminActionLabelNew}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.overviewHeader, { marginTop: 24 }]}>
                    <Text style={styles.modernSectionTitle}>Live Activity</Text>
                    <TouchableOpacity onPress={() => router.push('/(admin)/attendance-log' as any)}>
                        <Text style={{ color: BLUE_PRIMARY, fontWeight: '700', fontSize: 13 }}>Audit Logs</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    {recentAttendance.length > 0 ? (
                        recentAttendance.map((item, index) => (
                            <View key={index} style={styles.adminLogCard}>
                                <View style={[styles.adminLogIcon, { backgroundColor: BLUE_PRIMARY + '10' }]}>
                                    <Ionicons name="checkmark-circle" size={20} color={BLUE_PRIMARY} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.adminLogTitle}>{item.name}</Text>
                                    <Text style={styles.adminLogSub}>{item.course_code} · {item.department}</Text>
                                </View>
                                <View style={styles.adminLogTime}>
                                    <Text style={styles.adminLogTimeText}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.adminEmptyStateNew}>
                            <Ionicons name="pulse-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.adminEmptyTextNew}>Monitoring systems... No activity yet.</Text>
                        </View>
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            </View>
        </View>
    );

    const renderEligibilityChart = () => {
        const totalCourses = studentCourses.length;
        if (totalCourses === 0) {
            return (
                <View style={[styles.analyticsCard, { marginTop: 24, padding: 32, alignItems: 'center', backgroundColor: '#F8FAFC', borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0' }]}>
                    <Ionicons name="book-outline" size={48} color="#CBD5E1" />
                    <Text style={[styles.modernSectionTitle, { fontSize: 16, color: '#94A3B8', marginTop: 16 }]}>No Courses Registered</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, textAlign: 'center' }}>Once you are enrolled in courses, your eligibility will appear here.</Text>
                </View>
            );
        }

        return (
            <View style={{ marginTop: 24 }}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#1E293B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>Academic Summary</Text>
                    <LinearGradient
                        colors={['#F8FAFC', '#F1F5F9']}
                        style={{ padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', gap: 12, alignItems: 'center' }}
                    >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="information-circle" size={24} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: '#1E293B', fontWeight: '800', marginBottom: 2 }}>Attendance Policy</Text>
                            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '500', lineHeight: 14 }}>
                                A minimum of 75% attendance is required to be eligible to sit for exams.
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {studentCourses.map((course, idx) => {
                    const isEligible = (course.percentage || 0) >= 75;
                    const primaryColor = isEligible ? '#059669' : '#EF4444';
                    const secondaryColor = isEligible ? '#10B981' : '#DC2626';
                    
                    return (
                        <View 
                            key={idx} 
                            style={{ 
                                backgroundColor: '#FFF', 
                                borderRadius: 24, 
                                marginBottom: 20, 
                                overflow: 'hidden', 
                                elevation: 8,
                                shadowColor: primaryColor,
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.1,
                                shadowRadius: 15,
                                borderWidth: 1,
                                borderColor: '#F1F5F9'
                            }}
                        >
                            <LinearGradient
                                colors={[primaryColor, secondaryColor]}
                                style={{ padding: 20 }}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 }}>
                                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{course.code}</Text>
                                        </View>
                                        <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '900' }}>{course.percentage}%</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>Current Attendance</Text>
                                    </View>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <Ionicons name={isEligible ? "shield-checkmark" : "alert-circle"} size={32} color="#FFF" />
                                    </View>
                                </View>
                            </LinearGradient>
                            
                            <View style={{ padding: 20 }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 }} numberOfLines={2}>{course.name || 'Course Module'}</Text>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                    <View style={{ flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                                        <LinearGradient
                                            colors={isEligible ? ['#10B981', '#34D399'] : ['#F87171', '#EF4444']}
                                            style={{ height: '100%', width: `${course.percentage}%` }}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        />
                                    </View>
                                    <Text style={{ fontSize: 12, fontWeight: '900', color: primaryColor }}>{course.percentage}%</Text>
                                </View>

                                <View style={{ 
                                    padding: 12, 
                                    borderRadius: 16, 
                                    backgroundColor: isEligible ? '#F0FDF4' : '#FEF2F2',
                                    borderWidth: 1,
                                    borderColor: isEligible ? '#DCFCE7' : '#FEE2E2',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12
                                }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isEligible ? '#10B981' : '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name={isEligible ? "checkmark" : "close"} size={20} color="#FFF" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: isEligible ? '#166534' : '#991B1B' }}>
                                            {isEligible ? 'Eligible to sit for the exam' : 'Not eligible to sit for the exam'}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: isEligible ? '#15803D' : '#B91C1C', fontWeight: '600', marginTop: 1 }}>
                                            {isEligible ? 'Requirement fulfilled' : 'Minimum 75% required'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderActiveSessionCard = () => {
        if (!ongoingCourse) {
            return null;
        }

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.analyticsCard, { marginTop: 24, padding: 0, overflow: 'hidden', elevation: 8 }]}
                onPress={() => router.push({ pathname: '/(tabs)/academics', params: { courseId: ongoingCourse.id } } as any)}
            >
                <LinearGradient
                    colors={[BLUE_PRIMARY, '#1E40AF']}
                    style={{ padding: 24 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>SESSION ACTIVE NOW</Text>
                            </View>
                            <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 4 }}>{ongoingCourse.code}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{ongoingCourse.name}</Text>
                        </View>
                        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="flash" size={28} color="#FACC15" />
                        </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
                                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{ongoingCourse.session_time}</Text>
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>Room: N/A</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#FACC15', fontSize: 12, fontWeight: '800' }}>START MARKING</Text>
                            <Ionicons name="arrow-forward" size={16} color="#FACC15" />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderIdCard = () => {
        return (
            <View style={styles.idCardHeader}>
                <View style={styles.glowOuterContainer}>
                    <ReAnimated.View style={[styles.glowRotationWrapper, animatedBorderStyle]}>
                        <LinearGradient
                            colors={['#3B82F6', '#8B5CF6', '#FACC15', '#3B82F6']}
                            style={styles.glowGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                    </ReAnimated.View>

                    <View style={styles.glowInnerContent}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A']}
                            style={styles.idCardBg}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.idCardContent}>
                                <View style={styles.idCardTop}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={styles.schoolName} numberOfLines={3}>AMINU KANO COLLEGE OF ISLAMIC AND LEGAL STUDIES, KANO</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={handleLogout}
                                        style={[styles.idCardLogoBox, { width: 40, height: 40, backgroundColor: '#FFFFFF' }]}
                                    >
                                        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.idCardMain}>
                                    <View style={styles.idCardInfo}>
                                        <Text style={styles.idCardName}>{userName || 'Student Name'}</Text>
                                        <Text style={styles.idCardRegNo}>{userProfile?.reg_no || 'REG/2024/0001'}</Text>
                                        <View style={styles.idCardBadgeRow}>
                                            <View style={[styles.idCardBadge, { backgroundColor: '#059669' }]}>
                                                <Text style={styles.idCardStatusText}>ACTIVE</Text>
                                            </View>
                                            <View style={[styles.idCardBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                                <Text style={styles.idCardStatusText}>{(userProfile?.level || '100').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.idCardFooter}>
                                    <View style={styles.idCardFooterMet}>
                                        <Text style={styles.idFooterLabel}>DEPARTMENT</Text>
                                        <Text style={styles.idFooterValue} numberOfLines={1}>{userProfile?.department || 'Computer Science'}</Text>
                                    </View>
                                    <View style={styles.qrMiniBox}>
                                        <Ionicons name="qr-code" size={30} color="rgba(255,255,255,0.8)" />
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                </View>
            </View>
        );
    };

    const renderStudentView = () => (
        <View style={styles.studentViewContainer}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.studentContentBody}
                showsVerticalScrollIndicator={false}
            >


                {renderIdCard()}

                {renderEligibilityChart()}


                <View style={{ height: 100 }} />
            </ScrollView>

            <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => router.push('/(tabs)/register' as any)}
                activeOpacity={0.85}
            >
                <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.fabGradient}>
                    <Ionicons name="finger-print" size={28} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );


    return (
        <View style={styles.baseContainer}>
            <StatusBar barStyle="dark-content" />

            <AppHeader
                userName={userName}
                role={role}
                unreadCount={unreadCount}
                onMenuPress={toggleMenu}
            />

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={BLUE_PRIMARY} size="large" />
                </View>
            ) : (
                role === 'admin' ? renderAdminView() : renderStudentView()
            )}

            {renderMenu()}
        </View>
    );
}

const styles = StyleSheet.create({
    baseContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    headerGradient: {
        paddingBottom: 60,
        borderBottomLeftRadius: 50,
        borderBottomRightRadius: 50,
    },
    headerTopNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuToggleBtnRight: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarMainBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        marginRight: 12,
    },
    avatarMain: {
        width: '100%',
        height: '100%',
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    activeIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4ADE80',
    },
    onlineText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
    },
    horizontalStatsWrapper: {
        marginTop: -40,
        zIndex: 10,
    },
    horizontalStatsPadding: {
        paddingHorizontal: 24,
        gap: 16,
        paddingBottom: 20,
    },
    horizontalCard: {
        width: 160,
        padding: 20,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    trendDot: {
        width: 32,
        height: 32,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardMainVal: {
        fontSize: 28,
        fontWeight: '900',
        color: Colors.text,
    },
    cardSubtext: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
        marginTop: 2,
    },
    sectionBody: {
        paddingHorizontal: 24,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.text,
    },
    overviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 24,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
    },
    actionSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    primaryActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentActivityCard: {
        padding: 16,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityAvatar: {
        width: 48,
        height: 48,
        borderRadius: 14,
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityName: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.text,
    },
    activityTime: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    progressCard: {
        padding: 24,
    },
    progressTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
    },
    progressPercent: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.primary,
    },
    policyCard: {
        padding: 20,
        marginBottom: 12,
    },
    policyIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    policyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    policyBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#F59E0B',
    },
    policyMessage: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    policyMessageText: {
        fontSize: 13,
        color: Colors.text,
        fontWeight: '600',
        lineHeight: 18,
        fontStyle: 'italic',
    },
    progBarOuter: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progBarInner: {
        height: '100%',
        borderRadius: 4,
    },
    progressInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
    },
    progressTip: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuDrawer: {
        width: width * 0.75,
        height: height,
        backgroundColor: '#FFF',
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingTop: 40,
    },
    menuAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    menuAdminName: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
    },
    menuAdminRole: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    closeMenuBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 4,
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 24,
    },
    menuItemsList: {
        padding: 24,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    menuItemIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuItemText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    menuFooter: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    modernLogoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    modernLogoutText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#EF4444',
    },
    timeBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    courseStatCard: {
        padding: 16,
    },
    courseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 12,
    },
    courseIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseCodeShort: {
        fontSize: 10,
        fontWeight: '900',
        color: Colors.primary,
    },
    courseStatsInfo: {
        flex: 1,
    },
    courseNameText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 2,
    },
    courseSessionsText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    coursePercentBox: {
        alignItems: 'flex-end',
    },
    coursePercentText: {
        fontSize: 18,
        fontWeight: '900',
    },
    miniProgBarOuter: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    miniProgBarInner: {
        height: '100%',
        borderRadius: 3,
    },
    emptyCard: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.inactive,
        fontWeight: '600',
        textAlign: 'center',
    },
    studentViewContainer: {
        flex: 1,
    },
    modernHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    activeBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    activeIndicatorSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ADE80',
    },
    activeBadgeTextSmall: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    premiumHeaderCard: {
        paddingTop: 20,
        paddingBottom: 40,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    glassProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 24,
    },
    glassAvatarBox: {
        position: 'relative',
        marginRight: 16,
    },
    glassAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    glassStatusIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4ADE80',
        borderWidth: 2,
        borderColor: '#2563EB',
    },
    glassProfileInfo: {
        flex: 1,
    },
    glassGreeting: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600',
        marginBottom: 2,
    },
    glassName: {
        fontSize: 22,
        color: '#FFF',
        fontWeight: '800',
        marginBottom: 8,
    },
    glassBadgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    glassTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
    },
    glassTagText: {
        fontSize: 10,
        color: '#FFF',
        fontWeight: '700',
    },
    headerStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    headerStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    headerStatValue: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFF',
    },
    headerStatLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '700',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    headerStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    studentContentBody: {
        paddingHorizontal: 24,
    },
    modernSectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    modernActionCard: {
        marginTop: 10,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    modernActionGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
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
    modernActionSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    modernActionArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    eligibilityBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    eligibilityBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    modernProgressCard: {
        padding: 24,
        borderRadius: 28,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    modernProgTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modernProgLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    modernProgSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    modernProgValBox: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#F1F5F9',
    },
    modernProgVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#3B82F6',
    },
    modernProgBarOuter: {
        height: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 6,
        position: 'relative',
        overflow: 'hidden',
    },
    modernProgBarInner: {
        height: '100%',
        borderRadius: 6,
    },
    glowEffect: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 20,
        opacity: 0.3,
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    modernProgFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 8,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    modernProgTip: {
        fontSize: 11,
        fontWeight: '700',
    },
    modernCourseCard: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    modernCourseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    modernCourseIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modernCourseCode: {
        fontSize: 13,
        fontWeight: '900',
        color: '#475569',
    },
    modernCourseInfo: {
        flex: 1,
    },
    modernCourseName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
    },
    modernCourseDetails: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    modernCourseResult: {
        alignItems: 'flex-end',
    },
    modernCoursePercent: {
        fontSize: 18,
        fontWeight: '900',
    },
    microBarOuter: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    microBarInner: {
        height: '100%',
        borderRadius: 3,
    },
    modernEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#E2E8F0',
    },
    modernEmptyText: {
        marginTop: 12,
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        fontWeight: '600',
        lineHeight: 20,
    },
    referenceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        marginBottom: 10,
    },
    refHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bookMaterialCard: {
        width: 170,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    bookIconHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    bookBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    bookBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#059669',
    },
    bookTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
        lineHeight: 18,
        height: 36,
        marginBottom: 12,
    },
    bookFooter: {
        marginTop: 'auto',
    },
    bookPrice: {
        fontSize: 16,
        fontWeight: '900',
        color: BLUE_PRIMARY,
        marginBottom: 8,
    },
    bookActionBtn: {
        backgroundColor: '#F8FAFC',
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    bookActionText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
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
        position: 'relative',
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
    refHeroCard: {
        borderRadius: 30,
        padding: 25,
        height: 180,
        justifyContent: 'center',
        marginBottom: 20,
        overflow: 'hidden',
    },
    refHeroContent: {
        zIndex: 2,
    },
    refHeroTitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
        marginBottom: 8,
    },
    refHeroValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 5,
        marginBottom: 15,
    },
    refHeroValue: {
        fontSize: 36,
        fontWeight: '900',
        color: '#FFF',
    },
    refHeroBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
    },
    refHeroBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    refHeroWave: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        left: 0,
    },
    refStatsGrid: {
        gap: 15,
    },
    refGridRow: {
        flexDirection: 'row',
        gap: 15,
    },
    refGridCard: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    refGridIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    refGridIconBoxSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    refGridLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 8,
    },
    refGridValue: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    refGridUpdate: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '500',
    },
    // ===== RICH COURSE CARD STYLES =====
    overviewSub: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
    },
    richCourseCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    richCourseAccent: {
        width: 5,
    },
    richCourseTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    richCodeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    richCodeText: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    richStatusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 5,
    },
    richStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    richStatusLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    richCourseName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 12,
        lineHeight: 20,
    },
    richBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    richBarOuter: {
        flex: 1,
        height: 5,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    richBarInner: {
        height: '100%',
        borderRadius: 4,
    },
    richBarPct: {
        fontSize: 12,
        fontWeight: '800',
        minWidth: 36,
        textAlign: 'right',
    },
    richCourseBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    richMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    richMetaText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    // ===== ADMIN DASHBOARD STYLES =====
    adminHero: {
        marginHorizontal: 20,
        marginVertical: 16,
        borderRadius: 24,
        padding: 24,
        paddingRight: 80,
        overflow: 'hidden',
        minHeight: 130,
        justifyContent: 'center',
    },
    adminHeroContent: {
        gap: 4,
    },
    adminHeroSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    adminHeroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    adminHeroDate: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
        marginTop: 4,
    },
    adminStatStrip: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 10,
        marginBottom: 8,
    },
    adminStatCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderTopWidth: 3,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        gap: 4,
    },
    adminStatIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    adminStatValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
    },
    adminStatLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
        lineHeight: 13,
    },
    adminActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 4,
    },
    adminActionCard: {
        width: '47%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        gap: 6,
    },
    adminActionIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    adminActionLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    adminActionSub: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
    },
    adminActivityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    adminActivityAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminActivityName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    adminActivitySub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 2,
    },
    adminTimeBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    adminTimeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB',
    },
    adminEmptyActivity: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    adminEmptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
    floatingActionBtn: {
        position: 'absolute',
        bottom: 30,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // New Advanced Dashboard Styles
    idCardHeader: {
        marginTop: 24,
        marginBottom: 20,
    },
    idCardBg: {
        borderRadius: 24,
        padding: 40,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    idCardContent: {
        gap: 20,
    },
    // Glowing border styles
    glowOuterContainer: {
        borderRadius: 28,
        padding: 4, // Thickness of the glowing border
        overflow: 'hidden',
        backgroundColor: '#0F172A',
        position: 'relative',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    glowRotationWrapper: {
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
    },
    glowGradient: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    glowInnerContent: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#0F172A',
    },
    idCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    schoolName: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
        lineHeight: 14,
    },
    idCardLabel: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2,
    },
    idCardLogoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    idCardMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    idCardAvatarBox: {
        position: 'relative',
    },
    idCardAvatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    activePulse: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#0F172A',
    },
    idCardInfo: {
        flex: 1,
    },
    idCardName: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 4,
    },
    idCardRegNo: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    idCardBadgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    idCardBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    idCardStatusText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: '900',
    },
    idCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    idCardFooterMet: {
        flex: 1,
    },
    idFooterLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 2,
    },
    idFooterValue: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    qrMiniBox: {
        opacity: 0.8,
    },
    headerActionRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 24,
    },
    headerActionBtn: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    headerActionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    analyticsSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    inlineBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    inlineBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    analyticsCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        gap: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    analyticsStats: {
        alignItems: 'center',
        gap: 4,
    },
    analyticsLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    analyticsValue: {
        fontSize: 54,
        lineHeight: 60,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 4,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669',
    },
    sparklineBox: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        height: 80,
    },
    sparkCol: {
        alignItems: 'center',
        gap: 4,
    },
    sparkBar: {
        width: 14,
        borderRadius: 7,
    },
    sparkDay: {
        fontSize: 9,
        fontWeight: '600',
        color: '#94A3B8',
    },
    studentNameAnalytic: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        textAlign: 'center',
    },
    regNoAnalytic: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 2,
        letterSpacing: 1,
    },
    studentLogoutBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        zIndex: 10,
    },
    identityGroup: {
        alignItems: 'center',
        marginBottom: 24,
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    verifiedText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#059669',
        letterSpacing: 0.5,
    },
    metricsDivider: {
        width: '40%',
        height: 1,
        backgroundColor: '#F1F5F9',
        alignSelf: 'center',
        marginBottom: 24,
    },
    attendanceValueBox: {
        alignItems: 'center',
        marginBottom: 32,
    },
    systemStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    systemStatusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.2,
    },
    // Admin Overhaul Styles
    adminHeroNew: {
        paddingTop: 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    adminHeroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    adminSystemName: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
    },
    adminStatusTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
    },
    adminProfileBtnNew: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    adminStatRowNew: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    adminStatItemNew: {
        alignItems: 'center',
    },
    adminStatValNew: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFF',
    },
    adminStatLabNew: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.4)',
        marginTop: 2,
        textTransform: 'uppercase',
    },
    adminStatDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    adminContentBodyNew: {
        flex: 1,
        paddingHorizontal: 20,
        marginTop: 24,
    },
    adminActionsGridNew: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    adminActionCardNew: {
        width: '23%',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        gap: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    adminActionIconNew: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminActionLabelNew: {
        fontSize: 10,
        fontWeight: '800',
        color: '#475569',
    },
    adminLogCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    adminLogIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminLogTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    adminLogSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    adminLogTime: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    adminLogTimeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
    },
    adminEmptyStateNew: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    adminEmptyTextNew: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
    },
});
