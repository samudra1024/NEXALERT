import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

// Mock Data for Archived Items
const INITIAL_ARCHIVED_ITEMS = [
    { id: '1', title: 'John Doe', preview: 'Hey, are we still meeting tomorrow?', date: '2023-10-25' },
    { id: '2', title: 'Project Team', preview: 'Please review the latest design specs.', date: '2023-10-22' },
    { id: '3', title: 'Mom', preview: 'Call me when you get a chance.', date: '2023-10-15' },
    { id: '4', title: 'Bank Alert', preview: 'Your statement is ready to view.', date: '2023-09-30' },
    { id: '5', title: 'David Smith', preview: 'Thanks for the update!', date: '2023-09-12' },
];

export default function Archived() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [archivedItems, setArchivedItems] = useState(INITIAL_ARCHIVED_ITEMS);

    const handleRestore = (id) => {
        Alert.alert(
            "Restore",
            "Are you sure you want to restore this conversation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    onPress: () => {
                        // Remove from list to simulate restore
                        setArchivedItems(prev => prev.filter(item => item.id !== id));
                    }
                }
            ]
        );
    };

    const handleDelete = (id) => {
        Alert.alert(
            "Move to Recycle Bin",
            "This item will be moved to the Recycle Bin.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Move",
                    style: 'destructive',
                    onPress: () => {
                        setArchivedItems(prev => prev.filter(item => item.id !== id));
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, index }) => (
        <Animated.View
            entering={FadeInDown.delay(index * 100).duration(500).springify()}
            layout={Layout.springify()}
            style={[styles.itemContainer, { backgroundColor: theme.surface }]}
        >
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.itemPreview, { color: theme.textSecondary }]} numberOfLines={1}>{item.preview}</Text>
                <Text style={[styles.itemDate, { color: theme.textSecondary }]}>{item.date}</Text>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background }]}
                    onPress={() => handleRestore(item.id)}
                >
                    <Text style={[styles.actionIcon, { color: theme.primary }]}>↺</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background, marginLeft: 8 }]}
                    onPress={() => handleDelete(item.id)}
                >
                    <Text style={[styles.actionIcon, { color: theme.danger }]}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Archived</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Animated.Text
                    entering={FadeInDown.duration(600).springify()}
                    style={[styles.heading, { color: theme.text }]}
                >
                    Archived
                </Animated.Text>

                {archivedItems.length === 0 ? (
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={styles.emptyState}
                    >
                        <Text style={{ fontSize: 48, marginBottom: 16 }}>🗄️</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No archived items yet.</Text>
                    </Animated.View>
                ) : (
                    <FlatList
                        data={archivedItems}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </View>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    backButtonText: {
        fontSize: 24,
        fontWeight: '300',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    heading: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 20,
    },
    listContainer: {
        paddingBottom: 40,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    itemPreview: {
        fontSize: 14,
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        marginLeft: 12,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIcon: {
        fontSize: 18,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100, // Visual balance
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
