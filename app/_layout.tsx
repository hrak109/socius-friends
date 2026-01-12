import { Stack, useRouter, useSegments, Link, router } from 'expo-router';
import { useEffect } from 'react';
import 'dayjs/locale/ko'; // Import Korean locale for dayjs
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useSession } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { UserProfileProvider, useUserProfile } from '../context/UserProfileContext';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../services/api';
import { PROFILE_AVATAR_MAP } from '../constants/avatars';
import { Image, View } from 'react-native';



const MessagesHeaderRight = () => {
    const { colors } = useTheme();
    const { displayAvatar } = useUserProfile();
    const { user } = useSession();

    let avatarSource = null;
    if (displayAvatar && PROFILE_AVATAR_MAP[displayAvatar]) {
        avatarSource = PROFILE_AVATAR_MAP[displayAvatar];
    } else if (user?.photo) {
        avatarSource = { uri: user.photo };
    }

    const hasAvatar = !!avatarSource;

    const handleProfilePress = () => {
        router.push('/my_profile');
    };

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
                onPress={handleProfilePress}
                style={{ marginRight: 15 }}
            >
                {hasAvatar ? (
                    <Image
                        source={avatarSource}
                        style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                    />
                ) : (
                    <Ionicons name="person-circle-outline" size={42} color={colors.text} />
                )}
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.push('/settings')}
                style={{ marginRight: 15 }}
            >
                <Ionicons name="settings-outline" size={24} color={colors.text} />
            </TouchableOpacity>
        </View>
    );
};

function RootLayoutNav() {
    const { session, isLoading: isAuthLoading } = useSession();
    const { t } = useLanguage();
    const segments = useSegments();
    const router = useRouter();
    const { colors } = useTheme();
    const { setRouteSegments } = useNotifications();

    useEffect(() => {
        setRouteSegments(segments);
    }, [segments, setRouteSegments]);

    useEffect(() => {
        if (isAuthLoading) return;

        if (!session) {
            router.replace('/');
        } else if (session && segments[0] !== 'messages' && segments[0] !== 'chat' && segments[0] !== 'friends' && segments[0] !== 'socius-friends' && segments[0] !== 'settings' && segments[0] !== 'socius-setup' && segments[0] !== 'my_profile') {
            router.replace('/messages');
        }
    }, [session, segments, isAuthLoading, router]);



    return (
        <>
            <StatusBar style="auto" />
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                    name="messages"
                    options={{
                        title: t('messages.title'),
                        headerBackVisible: false,
                        headerRight: () => <MessagesHeaderRight />,
                    }}
                />
                <Stack.Screen name="chat/[id]" options={{ title: t('chat.title') }} />
                <Stack.Screen
                    name="my_profile"
                    options={{
                        title: t('profile.title')
                    }}
                />
                <Stack.Screen name="friends" options={{ title: t('friends.title') }} />
                <Stack.Screen name="socius-friends" options={{ title: t('friends.socius_friend'), presentation: 'modal' }} />
                <Stack.Screen name="settings" options={{ title: t('settings.title'), presentation: 'modal' }} />
                <Stack.Screen name="socius-setup/index" options={{ headerShown: false }} />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <LanguageProvider>
                        <NotificationProvider>
                            <UserProfileProvider>
                                <RootLayoutNav />
                            </UserProfileProvider>
                        </NotificationProvider>
                    </LanguageProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}
