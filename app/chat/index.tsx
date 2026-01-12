import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatInterface from '../../components/ChatInterface';

export default function SociusChatScreen() {
    const { context } = useLocalSearchParams<{
        context?: string;
    }>();

    // Default to 'global' if no context provided
    const chatContext = context || 'global';

    return (
        <ChatInterface
            context={chatContext}
        />
    );
}
