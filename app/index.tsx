import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

GoogleSignin.configure({
    webClientId: '801464542210-b08v4fc2tsk7ma3bfu30jc1frueps1on.apps.googleusercontent.com',
});

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, session } = useSession();
    const { colors } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (session) {
            router.replace('/messages');
        }
    }, [session, router]);

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

            const response = await api.post('/auth/google', { id_token: idToken });
            const { access_token } = response.data;

            await signIn(access_token);
            router.replace('/messages');
        } catch (err: any) {
            if (err.code === statusCodes.SIGN_IN_CANCELLED) {
                setError('Sign in cancelled');
            } else {
                setError(err.message || 'Failed to sign in');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <Ionicons name="people" size={80} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>Socius Friends</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Chat with friends and AI companions
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
                            <Text style={styles.googleButtonText}>Sign in with Google</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
});
