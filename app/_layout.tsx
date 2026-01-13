import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import 'dayjs/locale/ko'; /* Import Korean locale for dayjs */
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Image, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme, darkColors } from '../context/ThemeContext';
import { AuthProvider, useSession } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { UserProfileProvider, useUserProfile } from '../context/UserProfileContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { PROFILE_AVATAR_MAP } from '../constants/avatars';



const MessagesHeaderRight = () => {
    const { colors } = useTheme();
    const { displayAvatar } = useUserProfile();
    const { user } = useSession();
    const router = useRouter();

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

    // Configure Android navigation bar based on theme
    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync(colors.background);
            NavigationBar.setButtonStyleAsync(colors === darkColors ? 'light' : 'dark');
        }
    }, [colors]);

    useEffect(() => {
        if (isAuthLoading) return;

        // Cast to string to avoid TS errors with typed routes union
        const firstSegment = segments[0] as string | undefined;

        // Check if on a public route (root index is empty array, or onboarding)
        // segments is [] when on '/'
        const isPublicRoute = (segments as string[]).length === 0 || firstSegment === 'index' || firstSegment === 'onboarding';

        if (!session) {
            // If not logged in and not on a public route, redirect to login
            if (!isPublicRoute) {
                router.replace('/');
            }
        } else if (session) {
            // If logged in and on a public route (login/onboarding), redirect to messages
            if (isPublicRoute) {
                router.replace('/messages');
            }
        }
    }, [session, segments, isAuthLoading, router]);



    return (
        <>
            <StatusBar style={colors === darkColors ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerTitleStyle: { color: colors.text },
                    // Enable iOS swipe back gesture
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                    name="messages"
                    options={{
                        title: t('messages.title'),
                        headerBackVisible: false,
                        gestureEnabled: false, // Disable on main screen
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
                <Stack.Screen name="socius-friends" options={{ title: t('friends.socius_friend') }} />
                <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
                <Stack.Screen name="socius-setup/index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
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
        </GestureHandlerRootView>
    );
}
