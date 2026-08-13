import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    StatusBar,
    ScrollView,
    Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { ZoomIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { ArrowLeft, ChevronRight, HelpCircle, Info, FileText, Shield } from 'lucide-react-native';

export default function Settings() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const navigation = useNavigation();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', body: '' });

    const showModal = (title, body) => {
        setModalContent({ title, body });
        setModalVisible(true);
    };

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

    const SettingLink = ({ label, icon, onPress, color }) => (
        <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: theme.surface }]}
            onPress={onPress}
        >
            <View style={styles.linkContent}>
                {icon}
                <Text style={[styles.settingLabel, { color: color || theme.text, marginLeft: icon ? 12 : 0 }]}>{label}</Text>
            </View>
            <ChevronRight size={20} color={theme.textSecondary} />
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={theme.text} />
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

                {/* About & Legal Section (moved from AdvancedSettings) */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About & Legal</Text>
                <View style={styles.sectionContainer}>
                    <SettingLink
                        label="About App"
                        icon={<Info size={20} color={theme.primary} />}
                        onPress={() => showModal(
                            "About NEXALERT",
                            "NEXALERT v1.0.0\n\nA secure and efficient messaging application designed to keep you connected.\n\n⚡ Speed & Security\nReal-time analysis without compromising speed.\n\n🔒 Privacy First\nYour data stays on your device.\n\n✨ Simplicity\nA clean, distraction-free interface."
                        )}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingLink
                        label="Terms & Conditions"
                        icon={<FileText size={20} color={theme.primary} />}
                        onPress={() => showModal(
                            "Terms & Conditions",
                            "1. User Conduct: behave responsibly.\n2. Privacy: we respect your data.\n3. Usage: for personal communication only.\n\n(Full terms would go here...)"
                        )}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingLink
                        label="Privacy Policy"
                        icon={<Shield size={20} color={theme.primary} />}
                        onPress={() => showModal(
                            "Privacy Policy",
                            "We collect minimal data to provide this service. Your messages are stored locally or securely transmitted. We do not sell your data."
                        )}
                    />
                </View>

                {/* SMS Management */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Messages</Text>
                <View style={styles.sectionContainer}>
                    <SettingLink
                        label="Spam Folder"
                        icon={<Shield size={20} color={theme.primary} />}
                        onPress={() => navigation.navigate('Spam')}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingLink
                        label="Blocked Contacts"
                        icon={<Shield size={20} color={theme.primary} />}
                        onPress={() => navigation.navigate('Blocked')}
                    />
                </View>

                {/* Help & Feedback Section (moved from YourProfile menu) */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Support</Text>
                <View style={styles.sectionContainer}>
                    <SettingLink
                        label="Help & Feedback"
                        icon={<HelpCircle size={20} color={theme.primary} />}
                        onPress={() => showModal(
                            'Help & Feedback',
                            'For support, contact the NEXALERT team or report issues from the app store listing. Make sure SMS permissions and default SMS app role are enabled for full functionality.'
                        )}
                    />
                </View>

            </ScrollView>

            {/* Detail Modal */}
            <Modal
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <Animated.View
                        entering={ZoomIn.duration(300).springify()}
                        exiting={FadeOut.duration(200)}
                        style={[styles.modalView, { backgroundColor: theme.surface }]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.text }]}>{modalContent.title}</Text>
                        <ScrollView style={{ marginBottom: 20 }}>
                            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{modalContent.body}</Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.primary }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.onPrimary || '#fff' }]}>Close</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
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
    linkContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        marginLeft: 16,
    },

    // Modal Styles
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '85%',
        maxHeight: '70%',
    },
    modalTitle: {
        marginBottom: 15,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'left',
        fontSize: 16,
        lineHeight: 24,
    },
    closeButton: {
        borderRadius: 20,
        padding: 10,
        elevation: 2,
        minWidth: 100,
        alignItems: 'center',
    },
    closeButtonText: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
