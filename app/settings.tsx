import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useSession } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsScreen() {
    const router = useRouter();
    const { colors, isDark, toggleTheme, setAccentColor } = useTheme();
    const { signOut } = useSession();
    const { t, language, setLanguage } = useLanguage();

    // Settings State
    const [isTwoRow, setIsTwoRow] = React.useState(false);

    // Easter Egg State
    const [devTapCount, setDevTapCount] = React.useState(0);
    const [showEasterEgg, setShowEasterEgg] = React.useState(false);

    React.useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const twoRow = await AsyncStorage.getItem('user_apps_two_row');
            setIsTwoRow(twoRow === 'true');
        } catch { }
    };

    const toggleTwoRow = async (value: boolean) => {
        setIsTwoRow(value);
        await AsyncStorage.setItem('user_apps_two_row', String(value));
    };

    const handleSignOut = async () => {
        Alert.alert(
            t('settings.sign_out'),
            t('settings.sign_out_confirm') || 'Are you sure you want to sign out?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.sign_out'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await GoogleSignin.signOut();
                            await signOut();
                            router.replace('/');
                        } catch (error) {
                            console.error('Sign out error:', error);
                        }
                    },
                },
            ]
        );
    };

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'ko' : 'en');
    };

    const handleDevTap = () => {
        const newCount = devTapCount + 1;
        setDevTapCount(newCount);
        if (newCount === 5) {
            setShowEasterEgg(true);
            setDevTapCount(0);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Modal
                visible={showEasterEgg}
                transparent={false}
                animationType="fade"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowEasterEgg(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={1}
                    onPress={() => setShowEasterEgg(false)}
                >
                    <View
                        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#1a1a1a' }}
                    >
                        <Text style={{ fontSize: 80, marginBottom: 20 }}>🥚</Text>
                        <Text style={{ fontSize: 40, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 10 }}>
                            Hee Bae
                        </Text>
                        <Text style={{ fontSize: 24, fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
                            Master of the Universe
                        </Text>
                        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 40 }}>
                            (Tap anywhere to close)
                        </Text>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ScrollView>
                {/* Appearance */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.appearance')}
                    </Text>

                    <View style={[styles.row, { borderBottomColor: colors.border }]}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="moon-outline" size={22} color={colors.text} />
                            <Text style={[styles.rowText, { color: colors.text }]}>
                                {t('settings.dark_mode')}
                            </Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            thumbColor={isDark ? colors.primary : '#f4f3f4'}
                            trackColor={{ false: '#767577', true: isDark ? '#3e3e3e' : colors.primary }}
                        />
                    </View>

                    <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="language-outline" size={22} color={colors.text} />
                            <Text style={[styles.rowText, { color: colors.text }]}>
                                {t('settings.language')}
                            </Text>
                        </View>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                            {language === 'en' ? 'English' : '한국어'}
                        </Text>
                    </TouchableOpacity>

                    {/* 2-Row Apps List Toggle */}
                    <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="grid-outline" size={22} color={colors.text} />
                            <Text style={[styles.rowText, { color: colors.text }]}>
                                {t('settings.two_row_apps')}
                            </Text>
                        </View>
                        <Switch
                            value={isTwoRow}
                            onValueChange={toggleTwoRow}
                            thumbColor={isTwoRow ? colors.primary : '#f4f3f4'}
                            trackColor={{ false: '#767577', true: isTwoRow ? colors.primary : '#767577' }} // Use primary when active
                        />
                    </View>
                </View>

                {/* Accent Color */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.accent_color')}
                    </Text>

                    <View style={styles.colorContainer}>
                        {[
                            '#1a73e8', // Blue
                            '#7b1fa2', // Purple
                            '#34a853', // Green
                            '#f57c00', // Orange
                            '#e91e63', // Pink
                            '#d32f2f', // Red
                            '#00897b', // Teal
                            // New Colors
                            '#F48FB1', // Light Pink
                            '#CE93D8', // Light Purple
                            '#80CBC4', // Soft Teal
                            '#FFF59D', // Light Yellow
                            '#FFCC80', // Light Orange
                            '#BCAAA4', // Brownish
                            '#90CAF9', // Light Blue
                            '#546E7A', // Blue Grey
                        ].map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorCircle,
                                    { backgroundColor: color },
                                    colors.primary === color && styles.selectedColorCircle
                                ]}
                                onPress={() => setAccentColor(color)}
                            >
                                {colors.primary === color && (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Account */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.account')}
                    </Text>

                    <TouchableOpacity style={styles.row} onPress={handleSignOut}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="log-out-outline" size={22} color={colors.error} />
                            <Text style={[styles.rowText, { color: colors.error }]}>
                                {t('settings.sign_out')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* About */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {t('settings.about')}
                    </Text>

                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="information-circle-outline" size={22} color={colors.text} />
                            <Text style={[styles.rowText, { color: colors.text }]}>
                                {t('settings.version')}
                            </Text>
                        </View>
                        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>1.0.0</Text>
                    </View>

                    <TouchableOpacity style={styles.row} activeOpacity={1} onPress={handleDevTap}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="code-slash-outline" size={22} color={colors.text} />
                            <Text style={[styles.rowText, { color: colors.text }]}>
                                {t('settings.developer')}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.rowValue, { color: colors.textSecondary, fontSize: 14 }]}>Hee Bae 배희락</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>hrak109@gmail.com</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowText: {
        fontSize: 16,
    },
    rowValue: {
        fontSize: 16,
    },
    colorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 16,
    },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedColorCircle: {
        transform: [{ scale: 1.1 }],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});
