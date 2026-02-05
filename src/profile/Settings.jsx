import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    StatusBar,
    ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const navigation = useNavigation();

    const SettingToggle = ({ label, value, onToggle }) => (
        <View style={[styles.settingRow, { backgroundColor: theme.surface }]}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor={value ? "#f4f3f4" : "#f4f3f4"}
            />
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Notifications Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Notifications</Text>
                <View style={styles.sectionContainer}>
                    <SettingToggle
                        label="Incoming Message Sound"
                        value={settings.incomingSound}
                        onToggle={(val) => updateSettings('incomingSound', val)}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingToggle
                        label="Outgoing Message Sound"
                        value={settings.outgoingSound}
                        onToggle={(val) => updateSettings('outgoingSound', val)}
                    />
                </View>

                {/* Conversation Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Conversation Settings</Text>
                <View style={styles.sectionContainer}>
                    <SettingToggle
                        label="Pinch to Zoom text"
                        value={settings.pinchToZoom}
                        onToggle={(val) => updateSettings('pinchToZoom', val)}
                    />
                </View>

                {/* Advanced Section */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Advanced</Text>
                <View style={styles.sectionContainer}>
                    <TouchableOpacity
                        style={[styles.settingRow, { backgroundColor: theme.surface }]}
                        onPress={() => navigation.navigate('AdvancedSettings')}
                    >
                        <Text style={[styles.settingLabel, { color: theme.text }]}>Advanced Settings</Text>
                        <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
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
        padding: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        marginLeft: 16,
    },
    chevron: {
        fontSize: 24,
        fontWeight: '300',
    },
});
