import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';



export default function LoginScreen() {
    const router = useRouter();
    const { signIn, session } = useSession();
    const { colors } = useTheme();
    const { t, language } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAuthAndOnboarding = async () => {
            try {
                // 1. Check if user has selected language (First open)
                const selectedLanguage = await AsyncStorage.getItem('selected_language');

                if (!isMounted) return;

                if (!selectedLanguage) {
                    router.replace('/onboarding');
                    return;
                }

                // 2. If valid session, go to messages
                if (session) {
                    router.replace('/messages');
                    return;
                }

                // 3. Otherwise stay on login screen
                setIsCheckingOnboarding(false);
            } catch (e) {
                console.error("Error checking onboarding:", e);
                setIsCheckingOnboarding(false);
            }
        };

        checkAuthAndOnboarding();

        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session]); // Remove router from deps to avoid loop

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await GoogleSignin.hasPlayServices();
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult?.data?.idToken;

            if (!idToken) {
                throw new Error('No ID token received');
            }

            // Get Google profile photo
            const googlePhoto = signInResult?.data?.user?.photo || null;

            const response = await api.post('/auth/google', {
                id_token: idToken,
                photo: googlePhoto
            });
            const { access_token } = response.data;

            await signIn(access_token);

            // Save language preference to backend after login
            try {
                await api.put('/users/me', { language });
            } catch {

            }

            // Mark onboarding as complete
            await AsyncStorage.setItem('onboarding_complete', 'true');

            router.replace('/messages');
        } catch (err: any) {
            if (err.code === statusCodes.SIGN_IN_CANCELLED) {
                setError(t('common.cancelled'));
            } else {
                setError(err.message || t('common.error'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading while checking onboarding
    if (isCheckingOnboarding) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <TouchableOpacity
                    style={styles.languageButton}
                    onPress={() => router.push('/onboarding')}
                >
                    <Ionicons name="globe-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>

                <Image
                    source={require('../assets/images/icon.png')}
                    style={{ width: 100, height: 100, borderRadius: 20, marginBottom: 20 }}
                />
                <Text style={[styles.title, { color: colors.text }]}>
                    {language === 'ko' ? '소키어스 프렌즈' : 'Socius Friends'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {language === 'ko' ? '친구들이 기다리고 있어요!' : 'Your friends are waiting!'}
                </Text>

                {error && (
                    <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
                )}

                <TouchableOpacity
                    style={[styles.googleButton, { backgroundColor: '#fff', borderColor: colors.border }]}
                    onPress={handleGoogleSignIn}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#4285F4" />
                    ) : (
                        <>
                            <Image
                                source={{ uri: 'https://www.google.com/favicon.ico' }}
                                style={styles.googleIcon}
                            />
                            <Text style={styles.googleButtonText}>
                                {t('login.google_signin') !== 'login.google_signin' ? t('login.google_signin') : 'Sign in with Google'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 16,
        marginTop: 10,
        marginBottom: 40,
        textAlign: 'center',
    },
    error: {
        marginBottom: 20,
        textAlign: 'center',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        borderWidth: 1,
    },
    googleIcon: {
        width: 20,
        height: 20,
        marginRight: 10,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    languageButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 10,
        zIndex: 10,
    },
});

