import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal, FlatList, ActivityIndicator, Alert, TextInput, Keyboard, Animated, NativeSyntheticEvent, NativeScrollEvent, Platform, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import AppSpecificChatHead from '../components/AppSpecificChatHead';

// Import Bible Data
import KRV from '../constants/bible/bible.json';
import NIV from '../constants/bible/niv.json';
import GAEYEOK from '../constants/bible/gaeyeok.json';
import SAEBUNYEOK from '../constants/bible/saebunyeok.json';

interface BibleBook {
    name: string;
    chapters: string[][];
}

interface BibleData {
    name: string;
    books: BibleBook[];
}

const BIBLE_VERSIONS: { id: string; name: string; data: BibleData }[] = [
    { id: 'KRV', name: 'Korean Revised (KRV)', data: KRV as unknown as BibleData },
    { id: 'NIV', name: 'New International (NIV)', data: NIV as unknown as BibleData },
    { id: 'GAE', name: 'Gaeyeok (GAE)', data: GAEYEOK as unknown as BibleData },
    { id: 'SAE', name: 'Saebunyeok (SAE)', data: SAEBUNYEOK as unknown as BibleData },
];

export default function BibleScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { t, language } = useLanguage();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true); // Default loading to true to load persistence
    const [baseFontSize, setBaseFontSize] = useState(18);

    // State Definitions
    const [selectedVersion, setSelectedVersion] = useState<string>('NIV');
    const [searchText, setSearchText] = useState('');
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0, isTop: false });
    const accentColor = colors.primary;

    const currentBible = BIBLE_VERSIONS.find(v => v.id === selectedVersion)?.data || BIBLE_VERSIONS[0].data;

    const [selectedBookIndex, setSelectedBookIndex] = useState(0);
    const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
    const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [highlights, setHighlights] = useState<any[]>([]);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isVersionPickerVisible, setIsVersionPickerVisible] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(false);
    const [navMode, setNavMode] = useState<'book' | 'chapter'>('book');
    const [isZoomControlsVisible, setIsZoomControlsVisible] = useState(false);
    const [christianFriend, setChristianFriend] = useState<any>(null);

    // Reanimated
    const zoomIndicatorOpacity = useSharedValue(0);
    const animatedFontSize = useSharedValue(18);

    // Convert state to shared value on load
    useEffect(() => {
    }, [baseFontSize, animatedFontSize]);

    // Header auto-hide on scroll
    const lastScrollY = useRef(0);
    const headerTranslateY = useRef(new Animated.Value(0)).current;
    const HEADER_HEIGHT = 60 + insets.top; // Include safe area inset

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;
        const diff = currentScrollY - lastScrollY.current;

        if (suggestions.length > 0 || isVersionPickerVisible) {
            // Keep header visible when suggestions are shown or version picker is open
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
            return;
        }

        if (currentScrollY <= 0) {
            // At top - always show header
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else if (diff > 0 && currentScrollY > HEADER_HEIGHT) {
            // Scrolling down - hide header (fully including safe area)
            Animated.timing(headerTranslateY, {
                toValue: -HEADER_HEIGHT,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else if (diff < -10) {
            // Scrolling up - show header
            Animated.timing(headerTranslateY, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        lastScrollY.current = currentScrollY;
    };


    // Generate suggestions based on search text
    type Suggestion = {
        type: 'book' | 'chapter';
        bookIndex: number;
        bookName: string;
        chapter?: number;
        display: string;
    };

    const suggestions = useMemo((): Suggestion[] => {
        if (!searchText.trim() || !currentBible?.books) return [];

        const query = searchText.trim().toLowerCase();
        const results: Suggestion[] = [];

        // Find matching books
        currentBible.books.forEach((book: BibleBook, bookIndex: number) => {
            const bookName = book.name.toLowerCase();
            if (bookName.startsWith(query) || bookName.includes(query)) {
                // Add book suggestion
                results.push({
                    type: 'book',
                    bookIndex,
                    bookName: book.name,
                    display: book.name
                });

                // Add first few chapters
                const chaptersToShow = Math.min(3, book.chapters?.length || 0);
                for (let i = 0; i < chaptersToShow; i++) {
                    results.push({
                        type: 'chapter',
                        bookIndex,
                        bookName: book.name,
                        chapter: i,
                        display: language === 'ko'
                            ? `${book.name} ${i + 1}장`
                            : `${book.name} ${i + 1}`
                    });
                }
            }
        });

        // Also try to parse "Book Chapter" format
        const bookChapterMatch = query.match(/^(.+?)\s+(\d+)$/i);
        if (bookChapterMatch) {
            const bookQuery = bookChapterMatch[1];
            const chapterNum = parseInt(bookChapterMatch[2]);

            currentBible.books.forEach((book, bookIndex) => {
                const bookName = book.name.toLowerCase();
                if (bookName.startsWith(bookQuery) || bookName.includes(bookQuery)) {
                    const maxChapter = book.chapters?.length || 0;
                    if (chapterNum >= 1 && chapterNum <= maxChapter) {
                        // Check if not already in results
                        const exists = results.some(r => r.bookIndex === bookIndex && r.chapter === chapterNum - 1);
                        if (!exists) {
                            results.unshift({
                                type: 'chapter',
                                bookIndex,
                                bookName: book.name,
                                chapter: chapterNum - 1,
                                display: language === 'ko'
                                    ? `${book.name} ${chapterNum}장`
                                    : `${book.name} ${chapterNum}`
                            });
                        }
                    }
                }
            });
        }

        return results.slice(0, 6); // Limit to 6 suggestions
    }, [searchText, currentBible, language]);

    const selectSuggestion = (suggestion: Suggestion) => {
        Keyboard.dismiss();
        setSelectedBookIndex(suggestion.bookIndex);
        if (suggestion.chapter !== undefined) {
            setSelectedChapterIndex(suggestion.chapter);
        } else {
            setSelectedChapterIndex(0);
        }
        setSearchText('');
    };

    // Parse search query like "Genesis 1:5" or "창세기 1:5" or "Gen 1" or just "1:5"
    const handleSearch = (query: string) => {
        if (!query.trim() || !currentBible?.books) return;

        // Try to parse patterns like "Book Chapter:Verse" or "Book Chapter"
        // Examples: "Genesis 1:5", "창세기 1", "Gen 3:16", "1:5" (current book)
        const trimmed = query.trim();

        // Pattern: just chapter:verse for current book (e.g., "3:16")
        const chapterVerseMatch = trimmed.match(/^(\d+):(\d+)$/);
        if (chapterVerseMatch) {
            const chapter = parseInt(chapterVerseMatch[1]) - 1;
            // Note: verse parsing available via chapterVerseMatch[2] if needed for future scroll-to-verse feature
            if (currentBook && chapter >= 0 && chapter < currentBook.chapters.length) {
                setSelectedChapterIndex(chapter);
                setSearchText('');
                setIsSearchVisible(false);
                // Optionally scroll to verse - for now just navigate to chapter
                return;
            }
        }

        // Pattern: just chapter for current book (e.g., "3")
        const justChapterMatch = trimmed.match(/^(\d+)$/);
        if (justChapterMatch) {
            const chapter = parseInt(justChapterMatch[1]) - 1;
            if (currentBook && chapter >= 0 && chapter < currentBook.chapters.length) {
                setSelectedChapterIndex(chapter);
                setSearchText('');
                setIsSearchVisible(false);
                return;
            }
        }

        // Pattern: Book name + chapter (+ optional verse)
        // Try to find book by partial match
        const bookMatch = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
        if (bookMatch) {
            const bookName = bookMatch[1].toLowerCase();
            const chapter = parseInt(bookMatch[2]) - 1;

            // Find book by partial name match
            const bookIndex = currentBible.books.findIndex((b: BibleBook) =>
                b.name.toLowerCase().startsWith(bookName) ||
                b.name.toLowerCase().includes(bookName)
            );

            if (bookIndex >= 0) {
                const book = currentBible.books[bookIndex];
                if (chapter >= 0 && chapter < book.chapters.length) {
                    setSelectedBookIndex(bookIndex);
                    setSelectedChapterIndex(chapter);
                    setSearchText('');
                    setIsSearchVisible(false);
                    return;
                }
            }
        }

        // If no match found, try just book name
        const bookOnlyMatch = currentBible.books.findIndex((b: BibleBook) =>
            b.name.toLowerCase().startsWith(trimmed.toLowerCase()) ||
            b.name.toLowerCase().includes(trimmed.toLowerCase())
        );
        if (bookOnlyMatch >= 0) {
            setSelectedBookIndex(bookOnlyMatch);
            setSelectedChapterIndex(0);
            setSearchText('');
            setIsSearchVisible(false);
            return;
        }

        // No match - could show alert but for now just clear
        Alert.alert(t('common.error'), t('bible.search_not_found') || 'Book not found');
    };

    // Persistence Logic
    useEffect(() => {
        loadProgress();
        loadChristianFriend();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            saveProgress();
            loadHighlights();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVersion, selectedBookIndex, selectedChapterIndex]);

    // Clear selection when changing chapters
    useEffect(() => {
        setSelectedVerse(null);
        setIsActionModalVisible(false);
    }, [selectedVersion, selectedBookIndex, selectedChapterIndex]);

    const loadProgress = async () => {
        try {
            setIsLoading(true);
            const savedVersion = await AsyncStorage.getItem('bible_version');
            const savedBook = await AsyncStorage.getItem('bible_book');
            const savedChapter = await AsyncStorage.getItem('bible_chapter');
            const savedFontSize = await AsyncStorage.getItem('bible_font_size');

            if (savedVersion) setSelectedVersion(savedVersion);
            if (savedBook) setSelectedBookIndex(parseInt(savedBook));
            if (savedChapter) setSelectedChapterIndex(parseInt(savedChapter));
            if (savedFontSize) setBaseFontSize(parseFloat(savedFontSize));
        } catch (error) {
            console.error('Failed to load bible progress', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveProgress = async () => {
        try {
            await AsyncStorage.setItem('bible_version', selectedVersion);
            await AsyncStorage.setItem('bible_book', selectedBookIndex.toString());
            await AsyncStorage.setItem('bible_chapter', selectedChapterIndex.toString());
        } catch (error) {
            console.error('Failed to save bible progress', error);
        }
    };

    const saveFontSize = async (size: number) => {
        try {
            await AsyncStorage.setItem('bible_font_size', size.toString());
        } catch (error) {
            console.error('Failed to save font size', error);
        }
    };

    const handleZoom = (increment: number) => {
        const newSize = Math.min(Math.max(baseFontSize + increment, 12), 40);
        setBaseFontSize(newSize);
        saveFontSize(newSize);
        // Temporarily show indicator if modifying via buttons? Maybe not needed if menu is open.
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            animatedFontSize.value = Math.min(Math.max(baseFontSize * e.scale, 12), 40);
        })
        .onEnd(() => {
            runOnJS(setBaseFontSize)(animatedFontSize.value);
            runOnJS(saveFontSize)(animatedFontSize.value);
            zoomIndicatorOpacity.value = withDelay(1000, withTiming(0, { duration: 500 }));
        });



    const renderZoomControls = () => (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isZoomControlsVisible}
            onRequestClose={() => setIsZoomControlsVisible(false)}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setIsZoomControlsVisible(false)}
            >
                <View style={[styles.zoomControlsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.zoomTitle, { color: colors.text }]}>{t('bible.text_size') || 'Text Size'}</Text>

                    <View style={styles.zoomRow}>
                        <TouchableOpacity
                            style={[styles.zoomBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                            onPress={() => handleZoom(-2)}
                        >
                            <Ionicons name="remove" size={24} color={colors.text} />
                        </TouchableOpacity>

                        <Text style={[styles.zoomValue, { color: colors.text }]}>
                            {Math.round(baseFontSize)}
                        </Text>

                        <TouchableOpacity
                            style={[styles.zoomBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                            onPress={() => handleZoom(2)}
                        >
                            <Ionicons name="add" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const loadHighlights = async () => {
        try {
            const key = `highlights_${selectedVersion}_${selectedBookIndex}_${selectedChapterIndex}`;
            const saved = await AsyncStorage.getItem(key);
            if (saved) {
                setHighlights(JSON.parse(saved));
            } else {
                setHighlights([]);
            }
        } catch (error) {
            console.error('Failed to load highlights', error);
        }
    };

    const toggleHighlight = async () => {
        if (selectedVerse === null) return;

        let newHighlights;
        if (highlights.includes(selectedVerse)) {
            newHighlights = highlights.filter(h => h !== selectedVerse);
        } else {
            newHighlights = [...highlights, selectedVerse];
        }

        setHighlights(newHighlights);

        try {
            const key = `highlights_${selectedVersion}_${selectedBookIndex}_${selectedChapterIndex}`;
            await AsyncStorage.setItem(key, JSON.stringify(newHighlights));
        } catch (error) {
            console.error('Failed to save highlights', error);
        }
        setIsActionModalVisible(false);
        setSelectedVerse(null);
    };

    const handleCopy = async () => {
        if (selectedVerse === null || !currentChapter[selectedVerse]) return;
        const text = `${currentBook?.name} ${selectedChapterIndex + 1}:${selectedVerse + 1} - ${currentChapter[selectedVerse]}`;
        await Clipboard.setStringAsync(text);
        setIsActionModalVisible(false);
        setSelectedVerse(null);
        Alert.alert(t('common.success'), t('bible.copy_success') || 'Copied to clipboard');
    };

    const loadChristianFriend = async () => {
        try {
            const response = await api.get(`/friends/socius?_t=${Date.now()}`);
            const companions = response.data || [];
            const friend = companions.find((c: any) => c.role === 'christian');
            setChristianFriend(friend);
        } catch (error) {

        }
    };

    const handleAskSocius = () => {
        if (selectedVerse === null || !currentChapter[selectedVerse]) return;

        const verseText = currentChapter[selectedVerse];
        const reference = `${currentBook?.name} ${selectedChapterIndex + 1}:${selectedVerse + 1}`;
        const query = `${reference} - "${verseText}"`;

        setIsActionModalVisible(false);
        setSelectedVerse(null);

        if (christianFriend) {
            router.push({
                pathname: '/chat/[id]',
                params: {
                    id: `socius-${christianFriend.id}`,
                    type: 'socius',
                    name: christianFriend.name,
                    avatar: christianFriend.avatar,
                    sociusRole: christianFriend.role,
                    initialText: query
                }
            } as any);
        } else {
            // Fallback if friend not loaded - maybe just go to generic chat or show alert?
            // For now, try to go to socius-default but with context
            Alert.alert(t('common.error'), 'Socius friend not ready. Please try again.');
        }
    };

    // Derived State
    const validBookIndex = selectedBookIndex < (currentBible?.books?.length || 0) ? selectedBookIndex : 0;
    const currentBook = currentBible?.books?.[validBookIndex];
    const validChapterIndex = currentBook && selectedChapterIndex < (currentBook.chapters?.length || 0) ? selectedChapterIndex : 0;
    const currentChapter = currentBook?.chapters?.[validChapterIndex] || [];
    const hasValidData = currentBible && currentBook && Array.isArray(currentBook.chapters);


    // Auto-correct invalid state (e.g. after version change or bad load)
    useEffect(() => {
        if (selectedBookIndex !== validBookIndex) {
            setSelectedBookIndex(validBookIndex);
        }
        if (selectedChapterIndex !== validChapterIndex) {
            setSelectedChapterIndex(validChapterIndex);
        }
    }, [selectedBookIndex, validBookIndex, selectedChapterIndex, validChapterIndex]);

    const handleNextChapter = () => {
        if (!currentBook?.chapters || !currentBible?.books) return;

        if (validChapterIndex < currentBook.chapters.length - 1) {
            setSelectedChapterIndex(validChapterIndex + 1);
        } else if (validBookIndex < currentBible.books.length - 1) {
            setSelectedBookIndex(validBookIndex + 1);
            setSelectedChapterIndex(0);
        }
    };

    const handlePrevChapter = () => {
        if (validChapterIndex > 0) {
            setSelectedChapterIndex(validChapterIndex - 1);
        } else if (validBookIndex > 0) {
            const prevBookIndex = validBookIndex - 1;
            const prevBook = currentBible.books?.[prevBookIndex];
            if (prevBook?.chapters) {
                setSelectedBookIndex(prevBookIndex);
                setSelectedChapterIndex(prevBook.chapters.length - 1);
            }
        }
    };

    const renderNavModal = () => {
        if (!currentBible || !currentBible.books || !Array.isArray(currentBible.books)) {
            return null;
        }

        const bookForModal = currentBook;
        const chaptersData = bookForModal?.chapters;
        const hasValidChapters = chaptersData && Array.isArray(chaptersData) && chaptersData.length > 0;

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={isNavVisible}
                onRequestClose={() => setIsNavVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <TouchableOpacity onPress={() => setNavMode('book')}>
                                <Text style={[styles.modalTab, { color: colors.textSecondary }, navMode === 'book' && { color: colors.primary, fontWeight: 'bold' }]}>{t('bible.books')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setNavMode('chapter')}>
                                <Text style={[styles.modalTab, { color: colors.textSecondary }, navMode === 'chapter' && { color: colors.primary, fontWeight: 'bold' }]}>{t('bible.chapters')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsNavVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {navMode === 'book' ? (
                            <FlatList
                                key="books-list"
                                data={currentBible.books}
                                keyExtractor={(item, index) => `book-${index}`}
                                renderItem={({ item, index }) => (
                                    <TouchableOpacity
                                        style={[styles.navItem, { borderBottomColor: colors.border }]}
                                        onPress={() => {
                                            setSelectedBookIndex(index);
                                            setSelectedChapterIndex(0);
                                            setNavMode('chapter');
                                        }}
                                    >
                                        <Text style={[styles.navItemText, { color: colors.text }, selectedBookIndex === index && { color: colors.primary, fontWeight: 'bold' }]}>
                                            {item.name}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        ) : (
                            hasValidChapters ? (
                                <FlatList
                                    key="chapters-list"
                                    data={chaptersData}
                                    numColumns={5}
                                    keyExtractor={(item, index) => `chapter-${index}`}
                                    renderItem={({ index }) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.chapterBox,
                                                {
                                                    backgroundColor: selectedChapterIndex === index ? colors.primary : colors.inputBackground,
                                                    borderColor: selectedChapterIndex === index ? colors.primary : 'transparent',
                                                    borderWidth: 1
                                                }
                                            ]}
                                            onPress={() => {
                                                setSelectedChapterIndex(index);
                                                setIsNavVisible(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.chapterBoxText,
                                                { color: selectedChapterIndex === index ? '#fff' : colors.text }
                                            ]}>
                                                {index + 1}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            ) : (
                                <View style={styles.emptyStateContainer}>
                                    <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
                                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{t('bible.no_chapters')}</Text>
                                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>{t('bible.select_book_first')}</Text>
                                </View>
                            )
                        )}
                    </View>
                </View>
            </Modal>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: t('bible.title'), headerBackTitle: t('common.back'), gestureEnabled: true }} />

            {/* Animated Header that hides on scroll */}
            <Animated.View style={[
                styles.animatedHeaderContainer,
                {
                    transform: [{ translateY: headerTranslateY }],
                    backgroundColor: colors.background,
                    paddingTop: insets.top,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.3 : 0.08,
                    shadowRadius: 8,
                    elevation: 4,
                }
            ]}>
                <View style={styles.header}>
                    {/* Back button and Title */}
                    <View style={styles.headerTitleContainer}>
                        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                            <Ionicons name={Platform.OS === 'ios' ? "chevron-back" : "arrow-back"} size={26} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bible.title')}</Text>
                    </View>

                    {/* Search bar */}
                    <View style={[styles.searchBarContainer, {
                        backgroundColor: accentColor + (isDark ? '20' : '15'),
                    }]}>
                        <Ionicons name="search" size={16} color={accentColor} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchBarInput, { color: colors.text }]}
                            placeholder={currentBook?.name ? `${currentBook.name} ${validChapterIndex + 1}` : 'Search...'}
                            placeholderTextColor={colors.textSecondary}
                            value={searchText}
                            onChangeText={setSearchText}
                            onSubmitEditing={() => handleSearch(searchText)}
                            returnKeyType="go"
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClearBtn}>
                                <Ionicons name="close-circle" size={16} color={accentColor} />
                            </TouchableOpacity>
                        )}
                    </View>


                    {/* Header Actions: Version + Zoom */}
                    <View style={styles.headerActions}>
                        {/* Version selector pill */}
                        <TouchableOpacity
                            style={[styles.versionSelector, {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.primary + '15',
                            }]}
                            onPress={() => setIsVersionPickerVisible(!isVersionPickerVisible)}
                        >
                            <Text style={[styles.versionText, { color: colors.primary }]}>
                                {t(`bible.versions.${selectedVersion}`) || selectedVersion}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
                        </TouchableOpacity>

                        {/* Text Size Button */}
                        <TouchableOpacity
                            style={[styles.iconButton, {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            }]}
                            onPress={() => setIsZoomControlsVisible(true)}
                        >
                            <Ionicons name="text" size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
                <View style={[
                    styles.suggestionsContainer,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        top: 60 + insets.top,
                    }
                ]}>
                    {suggestions.map((suggestion, index) => (
                        <TouchableOpacity
                            key={`${suggestion.bookIndex}-${suggestion.chapter ?? 'book'}-${index}`}
                            style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                            onPress={() => selectSuggestion(suggestion)}
                        >
                            <Ionicons
                                name={suggestion.type === 'book' ? 'book-outline' : 'document-text-outline'}
                                size={18}
                                color={colors.textSecondary}
                                style={styles.suggestionIcon}
                            />
                            <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion.display}</Text>
                            {suggestion.type === 'chapter' && (
                                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}


            {isVersionPickerVisible && (
                <View style={[
                    styles.pickerContainer,
                    {
                        backgroundColor: colors.card,
                        borderBottomColor: colors.border,
                        top: 60 + insets.top,
                    }
                ]}>
                    {BIBLE_VERSIONS.map((v, index) => (
                        <TouchableOpacity
                            key={v.id}
                            style={[
                                styles.pickerItem,
                                {
                                    borderBottomColor: colors.border,
                                    backgroundColor: selectedVersion === v.id
                                        ? (isDark ? 'rgba(255,255,255,0.05)' : colors.primary + '08')
                                        : 'transparent',
                                },
                                index === BIBLE_VERSIONS.length - 1 && { borderBottomWidth: 0 }
                            ]}
                            onPress={() => {
                                setSelectedVersion(v.id);
                                setIsVersionPickerVisible(false);
                            }}
                        >
                            <View style={styles.pickerItemContent}>
                                <Text style={[
                                    styles.pickerItemText,
                                    { color: colors.text },
                                    selectedVersion === v.id && { color: colors.primary, fontWeight: '600' }
                                ]}>
                                    {t(`bible.versions.${v.id}`) || v.name}
                                </Text>
                                {selectedVersion === v.id && (
                                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {hasValidData ? (
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingTop: 60 + insets.top }]}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    <Text style={[styles.chapterTitle, { color: colors.text }]}>{currentBook?.name} {(validChapterIndex || 0) + 1}</Text>
                    {currentChapter.map((verse: string, idx: number) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.verseContainer,
                                highlights.includes(idx) && { backgroundColor: isDark ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 0, 0.3)', padding: 5, borderRadius: 5 }
                            ]}
                            activeOpacity={0.6}
                            onPress={(e) => {
                                const { pageY, locationX, locationY } = e.nativeEvent;
                                // Simple logic: if click is in top 60% of screen, show below. Else show above.
                                const screenHeight = Dimensions.get('window').height;
                                const isTop = pageY < screenHeight * 0.6;

                                setModalPosition({
                                    x: 20, // Constant left margin
                                    y: isTop ? pageY + 10 : pageY - 10,
                                    isTop
                                });
                                setSelectedVerse(idx);
                                setIsActionModalVisible(true);
                            }}
                        >
                            <Text style={[styles.verseNumber, { color: colors.textSecondary }]}>{idx + 1}</Text>
                            <Text style={[styles.bibleText, { color: colors.text, fontSize: baseFontSize, lineHeight: baseFontSize * 1.5 }]}>{verse || ''}</Text>
                        </TouchableOpacity>
                    ))}
                    <View style={{ height: 100 }} />
                </ScrollView>
            ) : (
                <View style={styles.content}>
                    <Text style={{ textAlign: 'center', marginTop: 50, color: colors.textSecondary }}>{t('bible.loading')}</Text>
                </View>
            )}

            {/* Floating Navigation Controls - iOS 26 Glassy Design */}
            {hasValidData && (
                <View style={styles.floatingNavContainer}>
                    <View style={[styles.glassyNavWrapper, { backgroundColor: isDark ? 'rgba(45, 45, 48, 0.85)' : 'rgba(255, 255, 255, 0.9)' }]}>
                        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.blurContainerExpanded}>
                            <TouchableOpacity onPress={handlePrevChapter} style={styles.navButton}>
                                <Ionicons name="chevron-back" size={22} color={isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)'} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setIsNavVisible(true)} style={styles.floatingNavCenter}>
                                <Text style={[styles.floatingBookName, { color: isDark ? 'rgba(255,255,255,0.98)' : 'rgba(0,0,0,0.9)' }]} numberOfLines={1}>
                                    {currentBook?.name}
                                </Text>
                                <Text style={[styles.floatingChapter, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }]}>
                                    {language === 'ko'
                                        ? `${selectedChapterIndex + 1}${t('bible.chapter')}`
                                        : `${t('bible.chapter')} ${selectedChapterIndex + 1}`}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleNextChapter} style={styles.navButton}>
                                <Ionicons name="chevron-forward" size={22} color={isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)'} />
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </View>
            )}

            {renderNavModal()}
            {renderZoomControls()}

            <Modal
                transparent={true}
                visible={isActionModalVisible}
                onRequestClose={() => setIsActionModalVisible(false)}
                animationType="fade"
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsActionModalVisible(false)}
                >
                    <View style={[
                        styles.bubbleMenu,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            top: modalPosition.isTop ? modalPosition.y : undefined,
                            bottom: !modalPosition.isTop ? (Dimensions.get('window').height - modalPosition.y) : undefined,
                        }
                    ]}>
                        <TouchableOpacity style={styles.bubbleMenuItem} onPress={handleAskSocius}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                            <Text style={[styles.bubbleMenuText, { color: colors.text }]}>{t('bible.ask_socius') || 'Ask Socius'}</Text>
                        </TouchableOpacity>
                        <View style={[styles.bubbleDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.bubbleMenuItem} onPress={handleCopy}>
                            <Ionicons name="copy-outline" size={20} color={colors.text} />
                            <Text style={[styles.bubbleMenuText, { color: colors.text }]}>{t('bible.copy')}</Text>
                        </TouchableOpacity>
                        <View style={[styles.bubbleDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.bubbleMenuItem} onPress={toggleHighlight}>
                            <Ionicons
                                name={selectedVerse !== null && highlights.includes(selectedVerse) ? "color-wand" : "color-wand-outline"}
                                size={20}
                                color={colors.text}
                            />
                            <Text style={[styles.bubbleMenuText, { color: colors.text }]}>
                                {selectedVerse !== null && highlights.includes(selectedVerse) ? t('bible.unhighlight') : t('bible.highlight')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Christian Friend Chat Head */}
            <AppSpecificChatHead roleType="christian" appContext="bible" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    actionSheet: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        borderRadius: 15,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    bubbleMenu: {
        position: 'absolute',
        left: 20,
        right: 20, // Full width minus margins
        borderRadius: 16,
        padding: 0,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        flexDirection: 'row',
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'space-between', // Try to distribute evenly or custom
    },
    bubbleMenuItem: {
        flex: 1,
        flexDirection: 'row', // Icon + Text layout
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
    },
    bubbleMenuText: {
        fontSize: 14,
        fontWeight: '600',
    },
    bubbleDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#eee',
    },
    actionItem: {
        alignItems: 'center',
        gap: 5,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    animatedHeaderContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    navSelector: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
    },
    navText: {
        fontWeight: '600',
    },
    versionSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    versionText: {
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.3,
    },
    pickerContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderBottomWidth: 1,
        elevation: 5,
        zIndex: 99,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    pickerItem: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pickerItemText: {
        fontSize: 16,
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 100,
        paddingTop: 16,
    },
    chapterTitle: {
        fontSize: 28,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 28,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    verseContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
        paddingVertical: 4,
    },
    verseNumber: {
        fontSize: 11,
        width: 28,
        paddingTop: 6,
        fontWeight: '600',
        opacity: 0.5,
    },
    bibleText: {
        flex: 1,
        // fontSize and lineHeight handled by animated style
        letterSpacing: 0.2,
        fontWeight: '400',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '75%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 16,
    },
    modalTab: {
        fontSize: 17,
        fontWeight: '600',
        marginRight: 24,
    },
    closeBtn: {
        marginLeft: 'auto',
        padding: 4,
    },
    navItem: {
        paddingVertical: 16,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    navItemText: {
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    chapterBox: {
        width: '18%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        margin: '1%',
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    chapterBoxText: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        opacity: 0.7,
    },
    emptyStateText: {
        fontSize: 17,
        marginTop: 16,
        fontWeight: '600',
    },
    emptyStateSubtext: {
        fontSize: 14,
        marginTop: 4,
    },
    floatingNavContainer: {
        position: 'absolute',
        bottom: 36,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    blurContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 25,
        overflow: 'hidden',
        minWidth: 140,
        justifyContent: 'space-between',
    },
    navButton: {
        padding: 5,
    },
    chapterIndicator: {
        fontSize: 15,
        fontWeight: '700',
        marginHorizontal: 8,
        letterSpacing: 0.3,
    },
    glassyNavWrapper: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chapterTouchable: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 16,
    },
    searchCloseBtn: {
        padding: 8,
        marginLeft: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchBtn: {
        padding: 5,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: -4,
        marginRight: 4,
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 36,
    },
    searchIcon: {
        marginRight: 6,
    },
    searchBarInput: {
        flex: 1,
        paddingVertical: 0,
        fontSize: 14,
        height: '100%',
    },
    searchClearBtn: {
        padding: 4,
        marginLeft: 2,
    },
    quickNavBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        gap: 8,
    },
    quickNavText: {
        fontSize: 16,
        fontWeight: '600',
    },
    quickNavChapter: {
        fontSize: 14,
        fontWeight: '500',
    },

    blurContainerExpanded: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 28,
        overflow: 'hidden',
        minWidth: 160,
        justifyContent: 'space-between',
    },
    floatingNavCenter: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 8,
    },
    floatingBookName: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        maxWidth: 140,
        letterSpacing: -0.2,
    },
    floatingChapter: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    zoomControlsCard: {
        width: '80%',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        alignSelf: 'center',
        marginBottom: 'auto',
        marginTop: 'auto',
    },
    zoomTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    zoomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },
    zoomBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomValue: {
        fontSize: 24,
        fontWeight: '600',
        minWidth: 50,
        textAlign: 'center',
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomIndicator: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -30,
        marginTop: -30,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    suggestionsContainer: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 90,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 8,
        overflow: 'hidden',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    suggestionIcon: {
        marginRight: 14,
        opacity: 0.7,
    },
    suggestionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
});
