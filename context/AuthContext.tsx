import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, removeToken, saveToken } from '../services/auth';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';

interface AuthContextType {
    session: string | null;
    isLoading: boolean;
    user: User['user'] | null;
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
}

GoogleSignin.configure({
    webClientId: '801464542210-b08v4fc2tsk7ma3bfu30jc1frueps1on.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
});

export const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    user: null,
    signIn: async () => { },
    signOut: async () => { },
});

export const useSession = () => useContext(AuthContext);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<string | null>(null);
    const [user, setUser] = useState<User['user'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadAuthData = async () => {
            try {
                const token = await getToken();
                if (token) {
                    setSession(token);
                }

                // Try silent sign in to get fresh profile (specifically photo URL which expires)
                try {
                    const silentUser = await GoogleSignin.signInSilently() as any;
                    if (silentUser?.user) {
                        setUser(silentUser.user);
                    }
                } catch (error) {
                    console.log('Silent sign in failed, falling back to cached user', error);
                    // Fallback to get current google user if signed in but silent failure (e.g. network)
                    const currentUser = await GoogleSignin.getCurrentUser();
                    if (currentUser?.user) {
                        setUser(currentUser.user);
                    }
                }

            } catch (e) {
                console.error('Failed to load auth data', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadAuthData();
    }, []);

    const signIn = React.useCallback(async (token: string) => {
        setSession(token);
        await saveToken(token);
        // Update user state immediately after sign in
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser?.user) {
            setUser(currentUser.user);
        }
    }, []);

    const signOut = React.useCallback(async () => {
        setSession(null);
        setUser(null);
        await removeToken();

        // Only clear user-specific data, preserve app settings (theme, language)
        const keysToRemove = [
            'user_display_name',
            'user_username',
            'user_display_avatar',
            'onboarding_complete',
            'user_passwords', // Clear sensitive password widget data
            'calorie_entries',
            'workout_activities'
            // Add other user-specific keys here as needed
        ];
        try {
            await AsyncStorage.multiRemove(keysToRemove);
            await GoogleSignin.signOut();
        } catch (error) {
            console.error(error);
        }
    }, []);

    const value = React.useMemo(() => ({
        session,
        isLoading,
        user,
        signIn,
        signOut,
    }), [session, isLoading, user, signIn, signOut]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
