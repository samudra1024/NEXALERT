import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import SmsController from '../../Controller/SmsController';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { ScreenContainer } from '../components/ScreenContainer';

export default function Archived() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [archivedItems, setArchivedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadArchived();

        const unsubscribe = navigation.addListener('focus', () => {
            loadArchived();
        });
        return unsubscribe;
    }, [navigation]);

    const loadArchived = async () => {
        try {
            setLoading(true);
            const conversations = await SmsController.getArchivedConversations();
            setArchivedItems(conversations);
        } catch (error) {
            console.error('Error loading archived:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = (item) => {
        Alert.alert(
            "Unarchive",
            `Move conversation with ${item.name} back to inbox?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unarchive",
                    onPress: async () => {
                        await SmsController.unarchiveConversation(item.id);
                        setArchivedItems(prev => prev.filter(i => i.id !== item.id));
                    }
                }
            ]
        );
    };

    const handleDelete = (item) => {
        Alert.alert(
            "Move to Recycle Bin",
            `Delete conversation with ${item.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        // Unarchive first, then recycle
                        await SmsController.unarchiveConversation(item.id);
                        await SmsController.recycleConversation(item.id, { displayName: item.name });
                        setArchivedItems(prev => prev.filter(i => i.id !== item.id));
                    }
                }
            ]
        );
    };

    const renderItem = useCallback(({ item }) => (
        <View
            style={[styles.itemContainer, { backgroundColor: theme.surface }]}
        >
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.avatar}</Text>
            </View>

            <View style={styles.itemContent}>
                <View style={styles.nameRow}>
                    <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={[styles.itemTime, { color: theme.textSecondary }]}>{item.time}</Text>
                </View>
                <Text style={[styles.itemPreview, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.lastMessage}
                </Text>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background }]}
                    onPress={() => handleRestore(item)}
                >
                    <RotateCcw size={18} color={theme.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background, marginLeft: 8 }]}
                    onPress={() => handleDelete(item)}
                >
                    <Trash2 size={18} color={theme.danger || '#ef4444'} />
                </TouchableOpacity>
            </View>
        </View>
    ), [theme, handleRestore, handleDelete]);

    return (
        <ScreenContainer
            backgroundColor={theme.background}
            statusBarStyle={theme.statusBar}
            statusBarBackgroundColor={theme.statusBg}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Archived</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {loading ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : archivedItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={{ fontSize: 48, marginBottom: 16 }}>🗄️</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>No archived chats</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            Swipe right on a chat to archive it
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={archivedItems}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={15}
                        windowSize={10}
                        initialNumToRender={15}
                    />
                )}
            </View>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    listContainer: {
        paddingBottom: 40,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        marginTop: 4,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    itemContent: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    itemTime: {
        fontSize: 12,
    },
    itemPreview: {
        fontSize: 14,
    },
    actionButtons: {
        flexDirection: 'row',
        marginLeft: 10,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
});
