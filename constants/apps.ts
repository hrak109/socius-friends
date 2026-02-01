export const DEFAULT_APPS = [
    { id: 'socius', label: 'friends.socius_friend', icon: 'sparkles', color: '#ffc320ff', route: '/socius-friends' },
    { id: 'friends', label: 'friends.user_friend', icon: 'people', color: '#007AFF', route: '/friends' },
    { id: 'bible', label: 'bible.title', icon: 'book', color: '#8D6E63', route: '/bible' },
    { id: 'calories', label: 'calories.title', icon: 'nutrition', color: '#34C759', route: '/calories' },
    { id: 'passwords', label: 'passwords.title', icon: 'key', color: '#5856D6', route: '/passwords' },
    { id: 'notes', label: 'notes.title', icon: 'document-text', color: '#FF9500', route: '/notes' },
    { id: 'diary', label: 'diary.title', icon: 'journal', color: '#FF2D55', route: '/diary' },
    { id: 'workout', label: 'workout.title', icon: 'fitness', color: '#FF3B30', route: '/workout' },
    { id: 'languages', label: 'languages.title', icon: 'globe', color: '#BDB2FF', route: '/languages' },
    { id: 'messages', label: 'messages.title', icon: 'chatbubbles', color: '#7E57C2', route: '/messages' },
];

export type AppItem = {
    id: string;
    label: string;
    icon: string;
    color: string;
    route: string;
};
