import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Animated,
    StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Smart Attendance',
        description: 'Mark your attendance securely and instantly using biometric fingerprint or secure passcode verification.',
        icon: 'finger-print-outline',
        colors: ['#1E40AF', '#2563EB'],
    },
    {
        id: '2',
        title: 'Track Progress',
        description: 'Monitor your attendance rate in real-time and ensure you meet the minimum requirements for your courses.',
        icon: 'stats-chart-outline',
        colors: ['#2563EB', '#3B82F6'],
    },
    {
        id: '3',
        title: 'Stay Organized',
        description: 'Manage courses, departments, and levels seamlessly with a centralized administrative dashboard.',
        icon: 'shield-checkmark-outline',
        colors: ['#1D4ED8', '#1E40AF'],
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems[0]) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const completeOnboarding = async () => {
        await AsyncStorage.setItem('HAS_SEEN_ONBOARDING', 'true');
        router.push('/(auth)/login');
    };

    const scrollToNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            completeOnboarding();
        }
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
        return (
            <View style={styles.slide}>
                <View style={styles.iconContainer}>
                    <LinearGradient
                        colors={item.colors as [string, string]}
                        style={styles.iconBackground}
                    >
                        <Ionicons name={item.icon as any} size={80} color="#FFF" />
                    </LinearGradient>
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1E40AF" />
            <SafeAreaView style={{ flex: 1 }}>
                {/* App branding header */}
                <View style={styles.brandHeader}>
                    <View style={styles.brandIconBox}>
                        <Ionicons name="shield-checkmark" size={22} color="#FFF" />
                    </View>
                    <Text style={styles.brandName}>mbsarari</Text>
                </View>

                <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={completeOnboarding}
                >
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>

                <FlatList
                    data={SLIDES}
                    renderItem={renderItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                        useNativeDriver: false,
                    })}
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />

                <View style={styles.footer}>
                    <View style={styles.paginator}>
                        {SLIDES.map((_, i) => {
                            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                            const dotWidth = scrollX.interpolate({
                                inputRange,
                                outputRange: [10, 20, 10],
                                extrapolate: 'clamp',
                            });
                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.3, 1, 0.3],
                                extrapolate: 'clamp',
                            });

                            return (
                                <Animated.View
                                    style={[styles.dot, { width: dotWidth, opacity }]}
                                    key={i.toString()}
                                />
                            );
                        })}
                    </View>

                    <TouchableOpacity style={styles.nextBtn} onPress={scrollToNext}>
                        <LinearGradient
                            colors={(currentIndex === SLIDES.length - 1 ? ['#FFFFFF', '#F1F5F9'] : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)']) as [string, string]}
                            style={styles.nextBtnGradient}
                        >
                            {currentIndex === SLIDES.length - 1 ? (
                                <Text style={styles.getStarted}>Get Started</Text>
                            ) : (
                                <Ionicons name="arrow-forward" size={24} color="#FFF" />
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1E40AF' },
    brandHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 8,
        gap: 10,
    },
    brandIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: 1,
    },
    skipBtn: {
        alignSelf: 'flex-end',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    slide: {
        width,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 50,
    },
    iconBackground: {
        width: 180,
        height: 180,
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 40,
    },
    paginator: {
        flexDirection: 'row',
        height: 64,
        alignItems: 'center',
    },
    dot: {
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 4,
    },
    nextBtn: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    nextBtnGradient: {
        width: 140,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 20,
    },
    getStarted: {
        color: '#1E40AF',
        fontSize: 16,
        fontWeight: '800',
    },
});
