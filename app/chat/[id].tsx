import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatInterface from '../../components/ChatInterface';

import { Stack } from 'expo-router';

export default function ChatScreen() {
    const { id, type, name, avatar } = useLocalSearchParams<{
        id: string;
        type: string;
        name: string;
        avatar: string;
    }>();
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

    return (
        <>
            <Stack.Screen options={{ title: name || 'Chat' }} />
            <ChatInterface
                context={context}
                friendId={friendId}
                companionId={companionId}

                friendName={name}
                friendAvatar={avatar}
                showHeader={false}
            />
        </>
    );
}
