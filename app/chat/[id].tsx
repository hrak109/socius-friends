import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatInterface from '../../components/ChatInterface';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ChatScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const params = useLocalSearchParams<{
        id: string;
        type: string;
        name: string;
        avatar: string;
        sociusRole?: string;
        initialText?: string;
    }>();
    const { id, type, name, avatar, sociusRole, initialText } = params;

    // Determine context based on type
    const isSocius = type === 'socius';
    // Use the ID as context for socius to keep conversations separate (e.g., socius-1, socius-2)
    const context = isSocius ? id : 'dm';
    const friendId = type === 'user' ? parseInt(id.replace('user-', '')) : undefined;

    // Extract companion ID if it's a custom socius friend
    let companionId: number | undefined;
    if (isSocius && id.startsWith('socius-')) {
        const idPart = id.replace('socius-', '');
        if (idPart !== 'default') {
            companionId = parseInt(idPart);
        }
    }

    // Map role to app
    const getAppForRole = (role?: string) => {
        // Handle legacy role names
        if (role === 'christian') return { path: '/bible', label: t('bible.title') || 'Bible', icon: 'book-outline' };
        if (role === 'cal_tracker' || role === 'tracker') return { path: '/calories', label: t('calories.title') || 'Calories', icon: 'nutrition-outline' };
        if (role === 'secrets') return { path: '/passwords', label: t('passwords.title') || 'Passwords', icon: 'key-outline' };
        if (role === 'workout') return { path: '/workout', label: t('workout.title') || 'Workout', icon: 'fitness-outline' };
        return null;
    };

    // Role themes for app icons
    const ROLE_THEMES: Record<string, { color: string; icon: string }> = {
        'christian': { color: '#8D6E63', icon: 'book' },
        'cal_tracker': { color: '#34C759', icon: 'nutrition' },
        'tracker': { color: '#34C759', icon: 'nutrition' },
        'secrets': { color: '#5856D6', icon: 'key' },
        'workout': { color: '#FF3B30', icon: 'fitness' },
    };

    const linkedApp = getAppForRole(sociusRole);
    const appTheme = sociusRole && ROLE_THEMES[sociusRole];

    return (
        <>
            <Stack.Screen
                options={{
                    title: name || 'Chat',
                    headerRight: (linkedApp && appTheme) ? () => (
                        <TouchableOpacity
                            onPress={() => router.push(linkedApp.path as any)}
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 8,
                            }}
                        >
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: appTheme.color,
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.15,
                                shadowRadius: 3,
                                elevation: 3,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)'
                            }}>
                                <Ionicons name={appTheme.icon as any} size={22} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    ) : undefined
                }}
            />
            <ChatInterface
                key={`${id}-${params.initialText || ''}`}
                context={context}
                friendId={friendId}
                companionId={companionId}

                friendName={name}
                friendAvatar={avatar}
                showHeader={false}
                initialMessage={id.startsWith('socius-') ? (initialText as string) : undefined}
            />
        </>
    );
}
