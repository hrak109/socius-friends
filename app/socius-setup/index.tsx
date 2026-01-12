import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    Image,
    SafeAreaView,
    Dimensions,
    ScrollView,
    Alert,
    Platform,
    PanResponder,
    KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useLanguage } from '../../context/LanguageContext';
import { SOCIUS_AVATAR_MAP } from '../../constants/avatars';
import api from '../../services/api';

const { width } = Dimensions.get('window');

// --- TYPES ---
type Step = 'role' | 'avatar' | 'name' | 'intimacy' | 'tone';

interface SetupState {
    role: string;
    avatar: string;
    name: string;
    intimacy: number; // 1-7
    tone: string;
}

// --- CONSTANTS ---
const ROLES = [
    { id: 'christian', label: 'Devoted Christian', icon: 'book' },
    { id: 'multilingual', label: 'Multilingual', icon: 'globe' },
    { id: 'tracker', label: 'Calorie Tracker', icon: 'nutrition' },
    { id: 'casual', label: 'Casual', icon: 'cafe' },
    { id: 'romantic', label: 'Romantic', icon: 'heart' },
    { id: 'assistant', label: 'Personal Assistant', icon: 'calendar' },
];

const TONES = [
    { id: 'formal', label: 'Formal', example: 'Hello, how may I assist you today?' },
    { id: 'casual', label: 'Casual', example: 'Hey! What are you up to?' },
    { id: 'friendly', label: 'Friendly', example: 'Hi friend! How is your day going?' },
];

export default function SociusSetupScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const { displayName } = useUserProfile();
    const [step, setStep] = useState<Step>('role');
    const [state, setState] = useState<SetupState>({
        role: '',
        avatar: 'socius-avatar-0',
        name: '',
        intimacy: 4, // Default to Friend level (middle of 1-7)
        tone: 'casual',
    });
    const [loading, setLoading] = useState(false);

    // --- Slider Logic ---
    const [sliderWidth, setSliderWidth] = useState(0);
    const sliderWidthRef = React.useRef(0); // Use ref to avoid stale closures in PanResponder

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                handleTouch(evt.nativeEvent.locationX);
            },
            onPanResponderMove: (evt) => {
                handleTouch(evt.nativeEvent.locationX);
            },
        })
    ).current;

    const handleTouch = (x: number) => {
        const width = sliderWidthRef.current;
        if (width === 0) return;

        let newIntimacy = Math.round((x / width) * 6) + 1;

        // Clamp values
        if (newIntimacy < 1) newIntimacy = 1;
        if (newIntimacy > 7) newIntimacy = 7;

        updateState('intimacy', newIntimacy);
    };

    const updateState = (key: keyof SetupState, value: any) => {
        setState(prev => ({ ...prev, [key]: value }));
    };

    const handleNext = () => {
        if (step === 'role') setStep('avatar');
        else if (step === 'avatar') setStep('name');
        else if (step === 'name') setStep('intimacy');
        else if (step === 'intimacy') setStep('tone');
        else if (step === 'tone') handleSubmit();
    };

    const handleBack = () => {
        if (step === 'role') router.back();
        else if (step === 'avatar') setStep('role');
        else if (step === 'name') setStep('avatar');
        else if (step === 'intimacy') setStep('name');
        else if (step === 'tone') setStep('intimacy');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await api.post('/friends/socius', {
                name: state.name,
                role: state.role,
                avatar: state.avatar,
                intimacy: state.intimacy,
                tone: state.tone,
            });
            router.replace('/messages'); // Go to messages screen
        } catch (error: any) {
            console.error('Failed to create Socius companion:', error);
            Alert.alert(t('common.error'), error.response?.data?.detail || 'Failed to create companion. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? 40 : 10 }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
                {t('setup.title')}
            </Text>
            <View style={{ width: 40 }} />
        </View>
    );

    const renderRoleStep = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.step_role_title')}</Text>
            <View style={styles.grid}>
                {ROLES.map(role => (
                    <TouchableOpacity
                        key={role.id}
                        style={[
                            styles.roleCard,
                            { backgroundColor: state.role === role.id ? colors.primary : colors.card, borderColor: colors.border }
                        ]}
                        onPress={() => updateState('role', role.id)}
                    >
                        <Ionicons
                            name={role.icon as any}
                            size={32}
                            color={state.role === role.id ? '#fff' : colors.primary}
                        />
                        <Text style={[
                            styles.roleLabel,
                            { color: state.role === role.id ? '#fff' : colors.text }
                        ]}>
                            {t(`setup.roles.${role.id}`)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const renderAvatarStep = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.step_avatar_title')}</Text>
            <View style={[styles.grid, { justifyContent: 'center', gap: 24 }]}>
                {Object.keys(SOCIUS_AVATAR_MAP).map(key => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.avatarOption,
                            {
                                borderColor: state.avatar === key ? colors.primary : 'transparent',
                                transform: [{ scale: state.avatar === key ? 1.1 : 1 }]
                            }
                        ]}
                        onPress={() => updateState('avatar', key)}
                    >
                        <Image source={SOCIUS_AVATAR_MAP[key]} style={styles.avatarImageLarge} />
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const renderNameStep = () => (
        <View style={styles.nameStepContainer}>
            {/* Show Selected Avatar */}
            <Image
                source={SOCIUS_AVATAR_MAP[state.avatar]}
                style={[styles.selectedAvatarPreview, { borderColor: colors.primary }]}
            />

            <Text style={[styles.stepTitle, { color: colors.text, marginBottom: 8 }]}>
                {t('setup.step_name_greeting').replace('{{name}}', displayName || 'User')}
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                {t('setup.step_name_prompt')}
            </Text>

            <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.primary, backgroundColor: colors.inputBackground }]}
                value={state.name}
                onChangeText={(text) => updateState('name', text)}
                placeholder={t('setup.step_name_placeholder')}
                placeholderTextColor={colors.textSecondary}
                autoFocus
            />
        </View>
    );

    const renderIntimacyStep = () => (
        <View style={styles.centerContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.step_intimacy_title')}</Text>
            <View style={styles.sliderContainer}>
                <View style={styles.sliderLabels}>
                    <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>{t('setup.intimacy.acquaintance')}</Text>
                    <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>{t('setup.intimacy.friend')}</Text>
                    <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>{t('setup.intimacy.lover')}</Text>
                </View>

                {/* Visual Slider Line */}
                <View style={[styles.sliderTrackRef, { backgroundColor: colors.border }]}>
                    <View style={[
                        styles.sliderFill,
                        {
                            backgroundColor: colors.primary,
                            width: `${((state.intimacy - 1) / 6) * 100}%`
                        }
                    ]} />
                    {/* Thumb */}
                    <View style={[
                        styles.sliderThumb,
                        {
                            backgroundColor: colors.primary,
                            left: `${((state.intimacy - 1) / 6) * 100}%`,
                            transform: [{ translateX: -12 }] // Center thumb
                        }
                    ]} />
                </View>

                {/* Touch Area Area for dragging */}
                <View
                    style={styles.sliderTouchContainer}
                    onLayout={(event) => {
                        const { width } = event.nativeEvent.layout;
                        setSliderWidth(width);
                        sliderWidthRef.current = width;
                    }}
                    {...panResponder.panHandlers}
                />
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                {t('setup.step_intimacy_desc')}
            </Text>
        </View>
    );

    const renderToneStep = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>{t('setup.step_tone_title')}</Text>
            <View style={styles.list}>
                {TONES.map(tone => (
                    <TouchableOpacity
                        key={tone.id}
                        style={[
                            styles.toneCard,
                            {
                                backgroundColor: state.tone === tone.id ? colors.primary : colors.card,
                                borderColor: colors.border
                            }
                        ]}
                        onPress={() => updateState('tone', tone.id)}
                    >
                        <Text style={[
                            styles.toneLabel,
                            { color: state.tone === tone.id ? '#fff' : colors.text }
                        ]}>
                            {t(`setup.tones.${tone.id}`)}
                        </Text>
                        <Text style={[
                            styles.toneExample,
                            { color: state.tone === tone.id ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                        ]}>
                            "{t(`setup.tones.${tone.id}_example`)}"
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const canProceed = () => {
        if (step === 'role') return !!state.role;
        if (step === 'avatar') return !!state.avatar;
        if (step === 'name') return !!state.name.trim();
        return true;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {renderHeader()}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            >
                {step === 'role' && renderRoleStep()}
                {step === 'avatar' && renderAvatarStep()}
                {step === 'name' && renderNameStep()}
                {step === 'intimacy' && renderIntimacyStep()}
                {step === 'tone' && renderToneStep()}
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.nextButton,
                        {
                            backgroundColor: canProceed() ? colors.primary : colors.border,
                            opacity: canProceed() ? 1 : 0.5
                        }
                    ]}
                    onPress={handleNext}
                    disabled={!canProceed() || loading}
                >
                    <Text style={styles.nextButtonText}>
                        {loading ? t('setup.creating') : step === 'tone' ? t('setup.finish') : t('setup.next')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    content: { flex: 1 },
    gridContainer: { padding: 20 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
    },
    list: { gap: 16 },
    stepTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    stepSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
    },
    roleCard: {
        width: (width - 56) / 2,
        aspectRatio: 1,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        gap: 12,
    },
    roleLabel: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    avatarOption: {
        borderWidth: 4,
        borderRadius: 60,
        padding: 4,
    },
    avatarImageLarge: {
        width: 100, // Bigger avatar
        height: 100,
        borderRadius: 50,
    },
    selectedAvatarPreview: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        alignSelf: 'center',
        marginBottom: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    nameStepContainer: {
        flex: 1,
        justifyContent: 'flex-start', // Pushes content to top
        padding: 20,
        paddingTop: 60, // Adds top spacing
    },
    input: {
        height: 56,
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 20,
        textAlign: 'center',
    },
    sliderContainer: {
        alignItems: 'center',
        marginVertical: 40,
        height: 60,
        justifyContent: 'center'
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        position: 'absolute',
        top: -30,
        left: 0
    },
    sliderLabel: { fontSize: 14, fontWeight: '600' },

    // Custom Slider Styles
    sliderTrackRef: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        position: 'relative',
        justifyContent: 'center'
    },
    sliderFill: {
        height: '100%',
        borderRadius: 3,
    },
    sliderThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        position: 'absolute',
        // translateX handled in inline style
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    sliderTouchContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        height: 60, // Larger hit area
        alignItems: 'center'
    },
    sliderTouchNode: {
        flex: 1,
        height: '100%',
        // debug: backgroundColor: 'rgba(255,0,0,0.1)'
    },

    helperText: {
        textAlign: 'center',
        marginTop: 40, // More spacing
        fontSize: 14,
    },
    toneCard: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
    },
    toneLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    toneExample: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    footer: {
        padding: 20,
    },
    nextButton: {
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
