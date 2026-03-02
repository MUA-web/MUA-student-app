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
import Card from '../../components/Card';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');
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
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchUserProfile();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            fetchUnreadCount();
            // Re-fetch dashboard data every time screen comes into focus
            // so attendance progress updates after student marks attendance
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) {
                    const userRole = session.user.user_metadata?.role || 'student';
                    fetchDashboardData(userRole, session.user.user_metadata);
                }
            });
        }, [])
    );

    const fetchUserProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                const user = session.user;
                const userRole = user.user_metadata?.role || 'student';
                setRole(userRole);
                setUserName(user.user_metadata?.full_name || 'User');
                setUserProfile(user.user_metadata);
                // Trigger dashboard data fetch without awaiting all of it for the main UI to show up
                fetchDashboardData(userRole, user.user_metadata);
            } else {
                setRole('admin');
                setUserName('Admin Setup');
                fetchDashboardData('admin', null);
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
                const regNo = profile?.reg_no;
                const deptName = profile?.department;
                const levelLabel = profile?.level;

                if (regNo) {
                    try {
                        const [attResult, coursesResult] = await Promise.all([
                            supabase
                                .from('attendance')
                                .select('*')
                                .eq('registration_number', regNo),
                            supabase
                                .from('courses')
                                .select('*, departments!inner(name), levels!inner(label)')
                                .eq('departments.name', deptName)
                                .eq('levels.label', levelLabel)
                        ]);

                        const attendanceRecords = attResult.data || [];
                        const allCourses = coursesResult.data || [];

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
                        fetchUnreadCount();

                        const totalAttended = attendanceRecords.length;
                        const totalSessionsSum = allCourses.reduce((sum, c) => sum + (c.total_sessions || 40), 0) || 1;

                        setStats(prev => ({
                            ...prev,
                            personalRate: Math.min(100, Math.round((totalAttended / totalSessionsSum) * 100))
                        }));
                    } catch (e) {
                        console.error('Error fetching student attendance:', e);
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
                            <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await supabase.auth.signOut(); router.replace('/(auth)/login'); }}>
                                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                                <Text style={styles.logoutText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Pressable>
        </Modal>
    );

    const renderHeader = () => (
        <View style={[styles.headerGradient, { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', elevation: 2, shadowOpacity: 0.05 }]}>
            <SafeAreaView edges={['top']}>
                <View style={styles.headerTopNav}>
                    <View style={styles.headerLeft}>
                        {role === 'student' && (
                            <TouchableOpacity style={styles.avatarMainBox}>
                                <Image
                                    source={{ uri: 'https://i.pravatar.cc/150?img=33' }}
                                    style={styles.avatarMain}
                                />
                            </TouchableOpacity>
                        )}
                        <View>
                            <View style={styles.badgeRow}>
                                <View style={styles.activeIndicator} />
                                <Text style={[styles.onlineText, { color: SLATE_MEDIUM }]}>{role.toUpperCase()} MODE</Text>
                            </View>
                            <Text style={[styles.headerTitle, { color: SLATE_DARK }]}>
                                {role === 'admin' ? `Welcome back, ${userName.split(' ')[0]}` : `Hello, ${userName.split(' ')[0]}`}
                            </Text>
                        </View>
                    </View>
                    {role === 'admin' && (
                        <TouchableOpacity onPress={toggleMenu} style={[styles.menuToggleBtnRight, { backgroundColor: '#F1F5F9' }]}>
                            <Ionicons name="menu-outline" size={32} color={BLUE_PRIMARY} />
                        </TouchableOpacity>
                    )}
                    {role === 'student' && (
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/notifications')}
                            style={[styles.menuToggleBtnRight, { backgroundColor: '#F1F5F9', width: 48, height: 48, borderRadius: 24 }]}
                        >
                            <Ionicons name="notifications-outline" size={24} color={BLUE_PRIMARY} />
                            {unreadCount > 0 && (
                                <View style={styles.refNotificationDot} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );

    const renderAdminView = () => (
        <>
            {/* Hero Banner */}
            <LinearGradient
                colors={['#1E40AF', '#2563EB', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.adminHero}
            >
                <View style={styles.adminHeroContent}>
                    <Text style={styles.adminHeroSub}>📊 System Overview</Text>
                    <Text style={styles.adminHeroTitle}>Attendance Control</Text>
                    <Text style={styles.adminHeroDate}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </View>
                <Ionicons name="shield-checkmark" size={80} color="rgba(255,255,255,0.12)" style={{ position: 'absolute', right: 16, bottom: 8 }} />
            </LinearGradient>

            {/* Stat Strip */}
            <View style={styles.adminStatStrip}>
                <View style={[styles.adminStatCard, { borderTopColor: '#2563EB' }]}>
                    <View style={[styles.adminStatIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="people" size={20} color="#2563EB" />
                    </View>
                    <Text style={styles.adminStatValue}>{stats.registered}</Text>
                    <Text style={styles.adminStatLabel}>Total{'\n'}Students</Text>
                </View>
                <View style={[styles.adminStatCard, { borderTopColor: '#059669' }]}>
                    <View style={[styles.adminStatIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#059669" />
                    </View>
                    <Text style={[styles.adminStatValue, { color: '#059669' }]}>{stats.present}</Text>
                    <Text style={styles.adminStatLabel}>Present{'\n'}Today</Text>
                </View>
                <View style={[styles.adminStatCard, { borderTopColor: '#DC2626' }]}>
                    <View style={[styles.adminStatIconBox, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="close-circle" size={20} color="#DC2626" />
                    </View>
                    <Text style={[styles.adminStatValue, { color: '#DC2626' }]}>{stats.absent}</Text>
                    <Text style={styles.adminStatLabel}>Absent{'\n'}Today</Text>
                </View>
                <View style={[styles.adminStatCard, { borderTopColor: '#D97706' }]}>
                    <View style={[styles.adminStatIconBox, { backgroundColor: '#FFFBEB' }]}>
                        <Ionicons name="stats-chart" size={20} color="#D97706" />
                    </View>
                    <Text style={[styles.adminStatValue, { color: '#D97706' }]}>{stats.attendanceRate}%</Text>
                    <Text style={styles.adminStatLabel}>Attend{'\n'}Rate</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.sectionBody}>
                <View style={styles.overviewHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>
                <View style={styles.adminActionsGrid}>
                    {[
                        { label: 'Attendance Log', sub: 'View all records', icon: 'list', color: '#2563EB', bg: '#EFF6FF', route: '/(admin)/attendance-log' },
                        { label: 'Students', sub: 'Manage accounts', icon: 'people', color: '#7C3AED', bg: '#F5F3FF', route: '/(admin)/students' },
                        { label: 'Courses', sub: 'Add or edit courses', icon: 'book', color: '#059669', bg: '#ECFDF5', route: '/(admin)/courses' },
                        { label: 'Settings', sub: 'App configuration', icon: 'settings', color: '#D97706', bg: '#FFFBEB', route: '/(admin)/settings' },
                    ].map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.adminActionCard}
                            onPress={() => router.push(item.route as any)}
                        >
                            <View style={[styles.adminActionIconBox, { backgroundColor: item.bg }]}>
                                <Ionicons name={item.icon as any} size={24} color={item.color} />
                            </View>
                            <Text style={styles.adminActionLabel}>{item.label}</Text>
                            <Text style={styles.adminActionSub}>{item.sub}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Recent Attendance */}
                <View style={[styles.overviewHeader, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <TouchableOpacity onPress={() => router.push('/(admin)/attendance-log' as any)}>
                        <Text style={{ color: BLUE_PRIMARY, fontWeight: '700', fontSize: 13 }}>View All</Text>
                    </TouchableOpacity>
                </View>

                {recentAttendance.length > 0 ? (
                    recentAttendance.map((item, index) => (
                        <View key={index} style={styles.adminActivityRow}>
                            <View style={[styles.adminActivityAvatar, { backgroundColor: BLUE_PRIMARY + '18' }]}>
                                <Ionicons name="person" size={20} color={BLUE_PRIMARY} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.adminActivityName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.adminActivitySub}>{item.department} · {item.level}</Text>
                            </View>
                            <View style={styles.adminTimeBadge}>
                                <Text style={styles.adminTimeBadgeText}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.adminEmptyActivity}>
                        <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
                        <Text style={styles.adminEmptyText}>No attendance records today</Text>
                    </View>
                )}
            </View>
        </>
    );

    const renderStudentView = () => (
        <View style={styles.studentViewContainer}>
            <View style={styles.studentContentBody}>
                <SafeAreaView edges={['top']}>
                    {/* New Header based on Reference */}
                    <View style={styles.referenceHeader}>
                        <View style={styles.refHeaderLeft}>
                            <View style={[styles.refAvatar, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="person" size={24} color={BLUE_PRIMARY} />
                            </View>
                            <View>
                                <Text style={styles.refWelcome}>Welcome Back!</Text>
                                <Text style={styles.refName}>{userName || 'Student'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.refNotificationBtn}>
                            <View style={styles.refNotificationDot} />
                            <Ionicons name="notifications-outline" size={24} color={SLATE_DARK} />
                        </TouchableOpacity>
                    </View>

                    {/* Hero Progress Card */}
                    <LinearGradient
                        colors={['#0EA5E9', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.refHeroCard}
                    >
                        <View style={styles.refHeroContent}>
                            <Text style={styles.refHeroTitle}>Semester Progress</Text>
                            <View style={styles.refHeroValueRow}>
                                <Text style={styles.refHeroValue}>{stats.personalRate}%</Text>
                            </View>
                            <View style={[styles.refHeroBadge, { backgroundColor: stats.personalRate >= 75 ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)' }]}>
                                <Text style={[styles.refHeroBadgeText, { color: stats.personalRate >= 75 ? '#6ee7b7' : '#fca5a5' }]}>
                                    {stats.personalRate >= 75 ? 'Eligible to seat to Seat Exam' : 'Not Eligible to Seat for Exam'}
                                </Text>
                            </View>
                        </View>
                        {/* Decorative wave element */}
                        <View style={styles.refHeroWave}>
                            <Ionicons name="trending-up" size={100} color="rgba(255,255,255,0.15)" style={{ position: 'absolute', right: -10, bottom: -20 }} />
                        </View>
                    </LinearGradient>

                    {/* Stats Grid 2x2 */}
                    <View style={styles.refStatsGrid}>
                        <View style={styles.refGridRow}>
                            <View style={styles.refGridCard}>
                                <View style={[styles.refGridIconBox, { backgroundColor: '#FEF3C7' }]}>
                                    <Ionicons name="book" size={20} color="#D97706" />
                                </View>
                                <Text style={styles.refGridLabel}>Total Courses</Text>
                                <Text style={styles.refGridValue}>{studentCourses.length}</Text>
                                <Text style={styles.refGridUpdate}>Update: {new Date().toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.refGridCard}>
                                <View style={[styles.refGridIconBox, { backgroundColor: '#ECFDF5' }]}>
                                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                </View>
                                <Text style={styles.refGridLabel}>Average Rate</Text>
                                <Text style={styles.refGridValue}>{stats.personalRate}%</Text>
                                <Text style={styles.refGridUpdate}>Update: {new Date().toLocaleDateString()}</Text>
                            </View>
                        </View>
                        <View style={styles.refGridRow}>
                            <View style={styles.refGridCard}>
                                <View style={[styles.refGridIconBox, { backgroundColor: '#EFF6FF' }]}>
                                    <Ionicons name="school" size={20} color="#2563EB" />
                                </View>
                                <Text style={styles.refGridLabel}>Department</Text>
                                <Text style={[styles.refGridValue, { fontSize: 13 }]}>{userProfile?.department || 'N/A'}</Text>
                                <Text style={styles.refGridUpdate}>Update: {new Date().toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.refGridCard}>
                                <View style={[styles.refGridIconBox, { backgroundColor: '#F5F3FF' }]}>
                                    <Ionicons name="ribbon" size={20} color="#7C3AED" />
                                </View>
                                <Text style={styles.refGridLabel}>Exam Eligibility</Text>
                                <Text style={[styles.refGridValue, { color: stats.personalRate >= 75 ? '#059669' : '#DC2626' }]}>
                                    {stats.personalRate >= 75 ? 'Eligible to Write Exam' : 'Not Eligible'}
                                </Text>
                                <Text style={styles.refGridUpdate}>Update: {new Date().toLocaleDateString()}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.overviewHeader, { marginTop: 20 }]}>
                        <Text style={styles.modernSectionTitle}>Assigned Courses</Text>
                        <Text style={styles.overviewSub}>{studentCourses.length} enrolled</Text>
                    </View>
                </SafeAreaView>

                {studentCourses.length > 0 ? (
                    studentCourses.map((course, index) => {
                        const pct = Math.min(100, course.percentage || 0);
                        const statusColor = pct >= 75 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';
                        const statusBg = pct >= 75 ? '#ECFDF5' : pct >= 50 ? '#FFFBEB' : '#FEF2F2';
                        const courseColors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
                        const cardColor = courseColors[index % courseColors.length];
                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.richCourseCard}
                                onPress={() => router.push({ pathname: '/(tabs)/classes', params: { courseId: course.id } })}
                                activeOpacity={0.85}
                            >
                                {/* Left accent bar */}
                                <View style={[styles.richCourseAccent, { backgroundColor: cardColor }]} />

                                <View style={{ flex: 1, padding: 16 }}>
                                    {/* Top row: code badge + status chip */}
                                    <View style={styles.richCourseTopRow}>
                                        <View style={[styles.richCodeBadge, { backgroundColor: cardColor + '18' }]}>
                                            <Text style={[styles.richCodeText, { color: cardColor }]}>{course.code}</Text>
                                        </View>
                                        <View style={[styles.richStatusChip, { backgroundColor: statusBg }]}>
                                            <View style={[styles.richStatusDot, { backgroundColor: statusColor }]} />
                                            <Text style={[styles.richStatusLabel, { color: statusColor }]}>
                                                {pct >= 75 ? 'Eligible' : pct >= 50 ? 'At Risk' : 'Not Eligible'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Course name */}
                                    <Text style={styles.richCourseName} numberOfLines={2}>{course.name}</Text>

                                    {/* Attendance bar */}
                                    <View style={styles.richBarRow}>
                                        <View style={styles.richBarOuter}>
                                            <View style={[styles.richBarInner, {
                                                width: `${pct}%` as any,
                                                backgroundColor: statusColor
                                            }]} />
                                        </View>
                                        <Text style={[styles.richBarPct, { color: statusColor }]}>{pct}%</Text>
                                    </View>

                                    {/* Bottom row */}
                                    <View style={styles.richCourseBottomRow}>
                                        <View style={styles.richMeta}>
                                            <Ionicons name="checkmark-circle-outline" size={13} color="#64748B" />
                                            <Text style={styles.richMetaText}>{course.attended} attended</Text>
                                        </View>
                                        <View style={styles.richMeta}>
                                            <Ionicons name="calendar-outline" size={13} color="#64748B" />
                                            <Text style={styles.richMetaText}>{course.total_sessions || 40} sessions</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <View style={styles.modernEmptyState}>
                        <Ionicons name="file-tray-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.modernEmptyText}>No enrolled courses found.</Text>
                    </View>
                )}
            </View>

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
        </View>
    );

    return (
        <View style={styles.baseContainer}>
            <StatusBar barStyle="dark-content" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
                {role === 'admin' && renderHeader()}
                {isLoading ? (
                    <View style={{ padding: 40 }}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                ) : (
                    role === 'admin' ? renderAdminView() : renderStudentView()
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
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
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.danger,
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
    modernLogoutBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
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
    // Reference-based Styles
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
    }
});
