import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Alert, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/services/api';
import { useRouter } from 'expo-router';

// Import Bible Data
import KRV from '@/constants/bible/bible.json';
import NIV from '@/constants/bible/niv.json';
import GAEYEOK from '@/constants/bible/gaeyeok.json';
import SAEBUNYEOK from '@/constants/bible/saebunyeok.json';

interface BibleBook {
    name: string;
    chapters: string[][];
}

interface BibleData {
    name: string;
    books: BibleBook[];
}

export const BIBLE_VERSIONS: { id: string; name: string; data: BibleData }[] = [
    { id: 'KRV', name: 'Korean Revised', data: KRV as unknown as BibleData },
    { id: 'NIV', name: 'New International', data: NIV as unknown as BibleData },
    { id: 'GAE', name: 'Gaeyeok', data: GAEYEOK as unknown as BibleData },
    { id: 'SAE', name: 'Saebunyeok', data: SAEBUNYEOK as unknown as BibleData },
];

export type Bookmark = {
    id: string;
    version: string;
    bookIndex: number;
    chapterIndex: number; // 0-based
    createdAt: string;
    label?: string;
    synced?: boolean;
};

export type Suggestion = {
    type: 'book' | 'chapter';
    bookIndex: number;
    bookName: string;
    chapter?: number;
    display: string;
};

export function useBible() {
    const { t, language } = useLanguage();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [baseFontSize, setBaseFontSize] = useState(18);
    const [selectedVersion, setSelectedVersion] = useState<string>('NIV');
    const [searchText, setSearchText] = useState('');

    // Selection State
    const [selectedBookIndex, setSelectedBookIndex] = useState(0);
    const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
    const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

    // Bookmarks & Highlights
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [highlights, setHighlights] = useState<any[]>([]);

    // UI Visibility State
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(false);
    const [navMode, setNavMode] = useState<'book' | 'chapter'>('book');
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isBookmarksVisible, setIsBookmarksVisible] = useState(false);

    // Context
    const [christianFriend, setChristianFriend] = useState<any>(null);

    const currentBible = useMemo(() =>
        BIBLE_VERSIONS.find(v => v.id === selectedVersion)?.data || BIBLE_VERSIONS[0].data,
        [selectedVersion]);

    // Derived Logic
    const validBookIndex = selectedBookIndex < (currentBible?.books?.length || 0) ? selectedBookIndex : 0;
    const currentBook = currentBible?.books?.[validBookIndex];
    const validChapterIndex = currentBook && selectedChapterIndex < (currentBook.chapters?.length || 0) ? selectedChapterIndex : 0;
    const currentChapter = currentBook?.chapters?.[validChapterIndex] || [];

    // --- Persistence & Initialization ---

    useEffect(() => {
        loadProgress();
        loadBookmarks();
        loadChristianFriend();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            saveProgress();
            loadHighlights();
            setSelectedVerse(null);
            setIsActionModalVisible(false);
        }
    }, [selectedVersion, selectedBookIndex, selectedChapterIndex]);

    // Auto-correct invalid indices
    useEffect(() => {
        if (selectedBookIndex !== validBookIndex) setSelectedBookIndex(validBookIndex);
        if (selectedChapterIndex !== validChapterIndex) setSelectedChapterIndex(validChapterIndex);
    }, [selectedBookIndex, validBookIndex, selectedChapterIndex, validChapterIndex]);

    const [autoHideHeader, setAutoHideHeader] = useState(true);

    const loadProgress = async () => {
        try {
            setIsLoading(true);
            const savedVersion = await AsyncStorage.getItem('bible_version');
            const savedBook = await AsyncStorage.getItem('bible_book');
            const savedChapter = await AsyncStorage.getItem('bible_chapter');
            const savedFontSize = await AsyncStorage.getItem('bible_font_size');
            const savedAutoHide = await AsyncStorage.getItem('bible_auto_hide');

            if (savedVersion) setSelectedVersion(savedVersion);
            if (savedBook) setSelectedBookIndex(parseInt(savedBook));
            if (savedChapter) setSelectedChapterIndex(parseInt(savedChapter));
            if (savedFontSize) setBaseFontSize(parseFloat(savedFontSize));
            if (savedAutoHide !== null) setAutoHideHeader(savedAutoHide === 'true');
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

    const setAutoHideHeaderAndSave = async (value: boolean) => {
        setAutoHideHeader(value);
        try {
            await AsyncStorage.setItem('bible_auto_hide', value.toString());
        } catch (error) {
            console.error('Failed to save auto hide setting', error);
        }
    };

    const handleZoom = (increment: number) => {
        const newSize = Math.min(Math.max(baseFontSize + increment, 12), 40);
        setBaseFontSize(newSize);
        saveFontSize(newSize);
    };

    // --- Highlights ---

    const loadHighlights = async () => {
        try {
            const key = `highlights_${selectedVersion}_${selectedBookIndex}_${selectedChapterIndex}`;
            const saved = await AsyncStorage.getItem(key);
            setHighlights(saved ? JSON.parse(saved) : []);
        } catch (error) {
            console.error('Failed to load highlights', error);
        }
    };

    const toggleHighlight = async () => {
        if (selectedVerse === null) return;
        let newHighlights = highlights.includes(selectedVerse)
            ? highlights.filter(h => h !== selectedVerse)
            : [...highlights, selectedVerse];

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

    // --- Bookmarks (Synced) ---

    // Sync Logic
    const syncBookmarks = useCallback(async (localBookmarks: Bookmark[]) => {
        // 1. Sync Pending
        const pending = localBookmarks.filter(b => !b.synced);
        let updated = [...localBookmarks];

        if (pending.length > 0) {
            for (const bm of pending) {
                try {
                    await api.post('/bible/bookmarks', {
                        client_id: bm.id,
                        version: bm.version,
                        book_index: bm.bookIndex,
                        chapter_index: bm.chapterIndex,
                        label: bm.label,
                        created_at: bm.createdAt
                    });
                    updated = updated.map(u => u.id === bm.id ? { ...u, synced: true } : u);
                } catch (error) {
                    console.error('Failed to sync bookmark', error);
                }
            }
            setBookmarks(updated);
            await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(updated));
        }

        // 2. Fetch Remote
        try {
            const res = await api.get('/bible/bookmarks');
            if (Array.isArray(res.data)) {
                const remoteIds = new Set(res.data.map((r: any) => r.client_id));
                const remoteBookmarks = res.data.map((r: any) => ({
                    id: r.client_id,
                    version: r.version,
                    bookIndex: r.book_index,
                    chapterIndex: r.chapter_index,
                    label: r.label,
                    createdAt: r.created_at_str || r.created_at,
                    synced: true
                }));

                const currentUnsynced = updated.filter(u => !u.synced && !remoteIds.has(u.id));
                const finalBookmarks = [...remoteBookmarks, ...currentUnsynced];
                finalBookmarks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setBookmarks(finalBookmarks);
                await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(finalBookmarks));
            }
        } catch (error) {
            // console.error('Failed to fetch remote bookmarks', error); // Silently fail offline
        }
    }, []);

    const loadBookmarks = async () => {
        try {
            const saved = await AsyncStorage.getItem('bible_bookmarks');
            let localBookmarks: Bookmark[] = [];
            if (saved) {
                localBookmarks = JSON.parse(saved);
                setBookmarks(localBookmarks);
            }
            syncBookmarks(localBookmarks);
        } catch (error) {
            console.error('Failed to load bookmarks', error);
        }
    };

    const togglePageBookmark = async () => {
        const existingIndex = bookmarks.findIndex(b =>
            b.bookIndex === selectedBookIndex &&
            b.chapterIndex === selectedChapterIndex &&
            b.version === selectedVersion
        );

        let newBookmarks;
        if (existingIndex >= 0) {
            const toRemove = bookmarks[existingIndex];
            newBookmarks = bookmarks.filter((_, i) => i !== existingIndex);
            setBookmarks(newBookmarks);
            await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(newBookmarks));
            try { await api.delete(`/bible/bookmarks/${toRemove.id}`); } catch (e) { }
        } else {
            const newBookmark: Bookmark = {
                id: Date.now().toString(),
                version: selectedVersion,
                bookIndex: selectedBookIndex,
                chapterIndex: selectedChapterIndex,
                createdAt: new Date().toISOString(),
                label: `${currentBook?.name} ${selectedChapterIndex + 1}`,
                synced: false
            };
            newBookmarks = [newBookmark, ...bookmarks];
            setBookmarks(newBookmarks);
            await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(newBookmarks));

            try {
                await api.post('/bible/bookmarks', {
                    client_id: newBookmark.id,
                    version: newBookmark.version,
                    book_index: newBookmark.bookIndex,
                    chapter_index: newBookmark.chapterIndex,
                    label: newBookmark.label,
                    created_at: newBookmark.createdAt
                });
                const final = newBookmarks.map(b => b.id === newBookmark.id ? { ...b, synced: true } : b);
                setBookmarks(final);
                await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(final));
            } catch (e) { }
        }
    };

    const deleteBookmark = async (id: string) => {
        const newBookmarks = bookmarks.filter(b => b.id !== id);
        setBookmarks(newBookmarks);
        await AsyncStorage.setItem('bible_bookmarks', JSON.stringify(newBookmarks));
        try { await api.delete(`/bible/bookmarks/${id}`); } catch (e) { }
    };

    const goToBookmark = (bookmark: Bookmark) => {
        setSelectedVersion(bookmark.version);
        setSelectedBookIndex(bookmark.bookIndex);
        setSelectedChapterIndex(bookmark.chapterIndex);
        setIsBookmarksVisible(false);
    };

    // --- Search & Navigation ---

    const parseQuery = useCallback((query: string) => {
        const normalized = query.trim().toLowerCase();
        // Remove numbers/spaces/colons from the end to get the "Book Name" part
        const textPart = normalized.replace(/[\d: ]+$/, '').trim();
        if (!textPart) return null;

        const numbers = query.match(/(\d+)(?::(\d+))?$/);
        const chapter = numbers ? parseInt(numbers[1]) : undefined;
        const verse = numbers && numbers[2] ? parseInt(numbers[2]) : undefined;

        let bestBookIndex = -1;

        // References for search (English and Korean)
        const refNIV = BIBLE_VERSIONS.find(v => v.id === 'NIV')?.data.books;
        const refKRV = BIBLE_VERSIONS.find(v => v.id === 'KRV')?.data.books;
        const currentBooks = currentBible?.books;

        if (!currentBooks) return null;
        const maxBooks = currentBooks.length;

        // Iterate all books to find match
        for (let i = 0; i < maxBooks; i++) {
            const namesToCheck = [
                currentBooks[i]?.name?.toLowerCase(),
                refNIV?.[i]?.name?.toLowerCase(),
                refKRV?.[i]?.name?.toLowerCase()
            ].filter(Boolean) as string[];

            const isExact = namesToCheck.includes(textPart);
            const isStart = namesToCheck.some(name => name.startsWith(textPart));

            if (isExact) {
                bestBookIndex = i;
                break; // Stop on exact match
            }

            if (isStart && bestBookIndex === -1) {
                bestBookIndex = i;
            }
        }

        if (bestBookIndex !== -1) {
            return {
                bookIndex: bestBookIndex,
                bookName: currentBible.books[bestBookIndex].name,
                chapter: chapter ? chapter - 1 : undefined,
                verse: verse ? verse - 1 : undefined
            };
        }
        return null;
    }, [currentBible]);

    const suggestions = useMemo((): Suggestion[] => {
        if (!searchText.trim() || !currentBible?.books) return [];
        const parsed = parseQuery(searchText);
        const results: Suggestion[] = [];

        // Helper for cross-lingual contains check
        const refNIV = BIBLE_VERSIONS.find(v => v.id === 'NIV')?.data.books;
        const refKRV = BIBLE_VERSIONS.find(v => v.id === 'KRV')?.data.books;

        if (parsed) {
            const { bookIndex, bookName, chapter } = parsed;
            const book = currentBible.books[bookIndex];

            if (chapter !== undefined) {
                results.push({
                    type: 'chapter', bookIndex, bookName: book.name, chapter: chapter,
                    display: language === 'ko' ? `${book.name} ${chapter + 1}장` : `${book.name} ${chapter + 1}`
                });
            }

            if (chapter === undefined) {
                results.push({ type: 'book', bookIndex, bookName: book.name, display: book.name });
                const chaptersToShow = Math.min(3, book.chapters?.length || 0);
                for (let i = 0; i < chaptersToShow; i++) {
                    results.push({
                        type: 'chapter', bookIndex, bookName: book.name, chapter: i,
                        display: language === 'ko' ? `${book.name} ${i + 1}장` : `${book.name} ${i + 1}`
                    });
                }
            }
        } else {
            // Fallback: Fuzzy search all books (Contains)
            const query = searchText.trim().toLowerCase();
            currentBible.books.forEach((book, bookIndex) => {
                const namesToCheck = [
                    book.name.toLowerCase(),
                    refNIV?.[bookIndex]?.name?.toLowerCase(),
                    refKRV?.[bookIndex]?.name?.toLowerCase()
                ].filter(Boolean) as string[];

                if (namesToCheck.some(name => name.includes(query))) {
                    results.push({ type: 'book', bookIndex, bookName: book.name, display: book.name });
                }
            });
        }
        return results.slice(0, 6);
    }, [searchText, currentBible, language, parseQuery]);

    const handleSearch = (query: string) => {
        if (!query.trim() || !currentBible?.books) return;

        const parsed = parseQuery(query);

        if (parsed) {
            setSelectedBookIndex(parsed.bookIndex);
            // Validate chapter
            const book = currentBible.books[parsed.bookIndex];
            let targetChapter = parsed.chapter || 0;
            if (targetChapter >= (book.chapters?.length || 0)) {
                targetChapter = 0; // fallback if out of range
            }
            setSelectedChapterIndex(targetChapter);

            // If verse is parsed, we could potentially highlight it or scroll to it.
            // For now, we just navigate to chapter. 
            // If I wanted to support verse selection:
            if (parsed.verse !== undefined) {
                // Need to expose a mechanism to scroll to verse. 
                // For now, just setting selectedVerse might trigger the 'menu', which is annoying.
                // So we ignore verse selection for navigation, just go to chapter.
            }

            setSearchText('');
            setIsSearchVisible(false);
        } else {
            // Fallback: simple text match
            const bookIndex = currentBible.books.findIndex(b => b.name.toLowerCase().includes(query.toLowerCase()));
            if (bookIndex >= 0) {
                setSelectedBookIndex(bookIndex);
                setSelectedChapterIndex(0);
                setSearchText('');
                setIsSearchVisible(false);
            } else {
                Alert.alert(t('common.error'), t('bible.search_not_found') || 'Book not found');
            }
        }
    };

    const selectSuggestion = (suggestion: Suggestion) => {
        Keyboard.dismiss();
        setSelectedBookIndex(suggestion.bookIndex);
        setSelectedChapterIndex(suggestion.chapter ?? 0);
        setSearchText('');
        setIsSearchVisible(false);
    };

    const handleNextChapter = () => {
        if (!currentBook?.chapters) return;
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

    // --- Actions ---

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
            setChristianFriend(companions.find((c: any) => c.role === 'christian'));
        } catch (e) { }
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
            Alert.alert(t('common.error'), 'Socius friend not ready.');
        }
    };

    return {
        // State
        isLoading,
        baseFontSize, handleZoom,
        selectedVersion, setSelectedVersion,
        selectedBookIndex, setSelectedBookIndex,
        selectedChapterIndex, setSelectedChapterIndex,
        selectedVerse, setSelectedVerse,

        // Data
        currentBible, currentBook, currentChapter,
        bookmarks, highlights,

        // UI State
        isSearchVisible, setIsSearchVisible,
        isActionModalVisible, setIsActionModalVisible,
        isNavVisible, setIsNavVisible,
        navMode, setNavMode,
        isSettingsVisible, setIsSettingsVisible,
        isBookmarksVisible, setIsBookmarksVisible,
        searchText, setSearchText,
        suggestions,

        // Methods
        handleSearch, selectSuggestion,
        handleNextChapter, handlePrevChapter,
        togglePageBookmark, deleteBookmark, goToBookmark,
        toggleHighlight, handleCopy, handleAskSocius,
        autoHideHeader, setAutoHideHeader: setAutoHideHeaderAndSave
    };
}
