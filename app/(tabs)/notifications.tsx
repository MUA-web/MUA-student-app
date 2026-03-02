import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const BLUE_PRIMARY = '#2563EB';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';
const SUCCESS_GREEN = '#22C55E';

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('student_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);

            if (error) throw error;

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('student_id', user.id)
                .eq('is_read', false);

            if (error) throw error;

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
            onPress={() => markAsRead(item.id)}
            activeOpacity={0.7}
        >
            <View style={[styles.iconBox, { backgroundColor: item.type === 'book' ? '#EFF6FF' : '#F1F5F9' }]}>
                <Ionicons
                    name={item.type === 'book' ? "book" : "notifications"}
                    size={24}
                    color={item.type === 'book' ? BLUE_PRIMARY : SLATE_MEDIUM}
                />
            </View>
            <View style={styles.contentBox}>
                <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, !item.is_read && styles.unreadText]}>{item.title}</Text>
                    {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemMessage}>{item.message}</Text>
                <Text style={styles.itemTime}>
                    {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={SLATE_DARK} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {notifications.some(n => !n.is_read) ? (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.markAllRef}>Mark all as read</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {isLoading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={BLUE_PRIMARY} />
                </View>
            ) : notifications.length > 0 ? (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchNotifications(); }} />
                    }
                />
            ) : (
                <View style={styles.centerBox}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="notifications-off-outline" size={64} color={SLATE_MEDIUM} />
                    </View>
                    <Text style={styles.emptyTitle}>All caught up!</Text>
                    <Text style={styles.emptySub}>No new notifications at the moment.</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    markAllRef: {
        fontSize: 13,
        fontWeight: '700',
        color: BLUE_PRIMARY,
    },
    listContent: {
        padding: 20,
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    unreadCard: {
        borderColor: '#DBEAFE',
        backgroundColor: '#F0F9FF',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    contentBox: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: SLATE_DARK,
    },
    unreadText: {
        fontWeight: '800',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: BLUE_PRIMARY,
    },
    itemMessage: {
        fontSize: 13,
        color: SLATE_MEDIUM,
        lineHeight: 18,
    },
    itemTime: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 8,
        fontWeight: '600',
    },
    centerBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100,
    },
    emptyIconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    emptySub: {
        fontSize: 14,
        color: SLATE_MEDIUM,
        marginTop: 8,
    },
});
