import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';

interface AppHeaderProps {
  title?: string;
  userName?: string;
  role?: 'admin' | 'student';
  unreadCount?: number;
  onMenuPress?: () => void;
  showBackButton?: boolean;
  rightElement?: React.ReactNode;
}

const BLUE_PRIMARY = '#2563EB';
const SLATE_DARK = '#0F172A';
const SLATE_MEDIUM = '#64748B';

export default function AppHeader({
  title,
  userName = 'User',
  role = 'student',
  unreadCount = 0,
  onMenuPress,
  showBackButton = false,
  rightElement,
}: AppHeaderProps) {
  const router = useRouter();

  const firstName = userName.trim().split(' ')[0];

  return (
    <View style={styles.headerContainer}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerTopNav}>
          <View style={styles.headerLeft}>
            {showBackButton ? (
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={SLATE_DARK} />
              </TouchableOpacity>
            ) : (
              role === 'student' && (
                <View style={[styles.avatarMainBox, { backgroundColor: BLUE_PRIMARY }]}>
                  <Text style={styles.avatarInitial}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            )}
            <View style={{ flex: 1 }}>
              {!title && (
                <View style={styles.badgeRow}>
                  <View style={styles.activeIndicator} />
                  <Text style={styles.onlineText}>{role.toUpperCase()} MODE</Text>
                </View>
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title ? title : (role === 'admin' ? `Welcome, ${firstName}` : `Hello, ${firstName}`)}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {rightElement ? (
              rightElement
            ) : role === 'admin' ? (
              <TouchableOpacity onPress={onMenuPress} style={styles.menuToggleBtn}>
                <Ionicons name="apps" size={24} color={BLUE_PRIMARY} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications')}
                style={styles.notificationBtn}
              >
                <Ionicons name="notifications-outline" size={24} color={BLUE_PRIMARY} />
                {unreadCount > 0 && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    zIndex: 100,
  },
  headerTopNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarMainBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    color: SLATE_MEDIUM,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: SLATE_DARK,
    fontSize: 18,
    fontWeight: '900',
  },
  menuToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFF',
    zIndex: 1,
  },
});
