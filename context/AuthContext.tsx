import React, { createContext, useContext, useState, useEffect } from 'react';
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
});

const AuthContext = createContext<AuthContextType>({
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

                // Try to get current google user if signed in
                const currentUser = await GoogleSignin.getCurrentUser();
                if (currentUser?.user) {
                    setUser(currentUser.user);
                } else if (token) {
                    // If we have token but no user loaded yet, maybe try silent sign in?
                    // For now, let's assume if token exists we might be valid.
                    try {
                        const silentUser = await GoogleSignin.signInSilently() as any;
                        if (silentUser?.user) {
                            setUser(silentUser.user);
                        }
                    } catch {
                        // Silent sign in failed
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
        try {
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
