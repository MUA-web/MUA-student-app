import React, { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ReAnimated, { 
    FadeIn, 
    FadeInDown, 
} from 'react-native-reanimated';
import AppHeader from '../../components/AppHeader';

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 600);

const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';
const SLATE_LIGHT = '#F8FAFC';

export default function AcademicsScreen() {
    const [courses, setCourses] = useState<any[]>([]);
    const [books, setBooks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState<'admin' | 'student'>('student');
    const router = useRouter();

    useEffect(() => {
        fetchInitialData();
        fetchUnreadCount();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: student } = await supabase
                .from('students')
                .select('department_id, level_id, department, level, full_name')
                .eq('id', user.id)
                .single();

            if (student) {
                setUserName(student.full_name || user.user_metadata?.full_name || 'Student');
                setRole(user.user_metadata?.role || 'student');
            } else {
                setUserName(user.user_metadata?.full_name || 'User');
                setRole(user.user_metadata?.role || 'student');
                return;
            }

            // Fetch Courses
            let coursesQuery = supabase.from('courses').select('*, departments!inner(name), levels!inner(label)');
            if (student.department_id && student.level_id) {
                coursesQuery = coursesQuery.eq('department_id', student.department_id)
                    .eq('level_id', student.level_id);
            } else {
                coursesQuery = coursesQuery.eq('departments.name', student.department)
                    .eq('levels.label', student.level);
            }

            // Fetch Books
            let booksQuery = supabase.from('books').select('*');
            if (student.department && student.level) {
                booksQuery = booksQuery.eq('department', student.department)
                    .eq('level', student.level);
            }

            const [coursesRes, booksRes] = await Promise.all([coursesQuery, booksQuery]);
            
            setCourses(coursesRes.data || []);
            setBooks(booksRes.data || []);
        } catch (error) {
            console.error('Error fetching initial academics data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('student_id', user.id)
                .eq('is_read', false);

            if (!error) setUnreadCount(count || 0);
        } catch (e) {
            console.error('Error fetching unread count:', e);
        }
    };

    const isWithinSchedule = (sessionDay: string, startTimeStr: string, durationStr: string) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const now = new Date();
        const currentDay = days[now.getDay()];

        const isToday = sessionDay && sessionDay.toLowerCase() === currentDay.toLowerCase();
        if (!isToday) return { valid: false, isToday: false, isUpcoming: false };

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

            return { valid: isActive, isToday: true, isUpcoming };
        } catch (e) {
            return { valid: true, isToday: true, isUpcoming: false };
        }
    };

    const renderCourseCard = (course: any, type: 'ongoing' | 'upcoming' | 'other', index: number) => {
        const isActive = type === 'ongoing';
        const isUpcoming = type === 'upcoming';

        return (
            <ReAnimated.View 
                key={`${type}-${index}`}
                entering={FadeInDown.delay(index * 100).springify()}
                style={[
                    styles.courseItemLarge,
                    isActive && styles.ongoingCard,
                    isUpcoming && styles.upcomingCardToday
                ]}
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
                        <Text style={[styles.courseItemCode, isActive && { color: '#FFF' }]}>
                            {course.code?.toUpperCase()}
                        </Text>
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
            </ReAnimated.View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <AppHeader
                title="Academics"
                userName={userName}
                role={role}
                unreadCount={unreadCount}
            />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {isLoading ? (
                    <ActivityIndicator color={BLUE_PRIMARY} size="large" style={{ marginTop: 40 }} />
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

                        return (
                            <>
                                {ongoing.length > 0 && (
                                    <View style={styles.sectionHeaderWrap}>
                                        <Text style={styles.sectionTitle}>Ongoing Now</Text>
                                        <View style={styles.sectionActiveLine} />
                                    </View>
                                )}
                                {ongoing.map((c, i) => renderCourseCard(c, 'ongoing', i))}

                                {upcomingToday.length > 0 && (
                                    <View style={[styles.sectionHeaderWrap, { marginTop: 12 }]}>
                                        <Text style={styles.sectionTitle}>Upcoming Today</Text>
                                    </View>
                                )}
                                {upcomingToday.map((c, i) => renderCourseCard(c, 'upcoming', i))}

                                {ongoing.length === 0 && upcomingToday.length === 0 && (
                                    <View style={styles.todayNoClassCard}>
                                        <View style={styles.infoCircle}>
                                            <Ionicons name="calendar-outline" size={24} color={SLATE_MEDIUM} />
                                        </View>
                                        <Text style={styles.todayNoClassText}>No lectures scheduled for today.</Text>
                                    </View>
                                )}

                                {/* Available Books Section */}
                                {books.length > 0 && (
                                    <>
                                        <View style={[styles.sectionHeaderWrap, { marginTop: 24 }]}>
                                            <Text style={styles.sectionTitle}>Books & Materials</Text>
                                        </View>
                                        <ScrollView 
                                            horizontal 
                                            showsHorizontalScrollIndicator={false} 
                                            contentContainerStyle={{ gap: 16, paddingRight: 24 }}
                                        >
                                            {books.map((book, bIdx) => (
                                                <TouchableOpacity 
                                                    key={bIdx} 
                                                    style={styles.bookCard}
                                                    activeOpacity={0.9}
                                                >
                                                    <LinearGradient
                                                        colors={['#4F46E5', '#3730A3']}
                                                        style={styles.bookCover}
                                                    >
                                                        <Ionicons name="book" size={32} color="rgba(255,255,255,0.4)" />
                                                        <View style={styles.bookTag}>
                                                            <Text style={styles.bookTagText}>NEW</Text>
                                                        </View>
                                                    </LinearGradient>
                                                    <View style={styles.bookContent}>
                                                        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                                                        <Text style={styles.bookPrice}>₦{parseFloat(book.price).toLocaleString()}</Text>
                                                        <TouchableOpacity style={styles.buyBtn}>
                                                            <Text style={styles.buyBtnText}>Purchase</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </>
                                )}

                                <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 16 }]}>All Enrolled Courses</Text>
                                {otherCourses.map((c, i) => renderCourseCard(c, 'other', i))}
                            </>
                        );
                    })()
                ) : (
                    <View style={styles.emptyStateContainer}>
                        <Ionicons name="book-outline" size={60} color={SLATE_LIGHT} />
                        <Text style={styles.emptyText}>No assigned courses found.</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity
                style={styles.floatingActionBtn}
                onPress={() => router.push('/(tabs)/register' as any)}
                activeOpacity={0.85}
            >
                <LinearGradient
                    colors={[BLUE_PRIMARY, '#1D4ED8']}
                    style={styles.fabGradient}
                >
                    <Ionicons name="finger-print" size={28} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
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
    ongoingCard: {
        backgroundColor: BLUE_PRIMARY,
        borderColor: BLUE_PRIMARY,
        borderWidth: 1,
        shadowColor: BLUE_PRIMARY,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
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
    emptyStateContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, color: SLATE_MEDIUM, marginTop: 16, fontWeight: '600' },
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
    // Book Card Styles
    bookCard: {
        width: 160,
        backgroundColor: '#FFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        marginBottom: 8,
    },
    bookCover: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    bookTag: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FACC15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bookTagText: {
        fontSize: 8,
        fontWeight: '900',
        color: SLATE_DARK,
    },
    bookContent: {
        padding: 12,
    },
    bookTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: SLATE_DARK,
        height: 36,
        lineHeight: 18,
    },
    bookPrice: {
        fontSize: 14,
        fontWeight: '800',
        color: BLUE_PRIMARY,
        marginTop: 6,
    },
    buyBtn: {
        marginTop: 10,
        backgroundColor: BLUE_LIGHT,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
    },
    buyBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: BLUE_PRIMARY,
    },
});
