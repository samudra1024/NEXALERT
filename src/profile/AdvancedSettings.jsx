import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    StatusBar,
    ScrollView // Added ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

export default function AdvancedSettings() {
    const { theme } = useTheme();
    const navigation = useNavigation();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', body: '' });

    const showModal = (title, body) => {
        setModalContent({ title, body });
        setModalVisible(true);
    };

    const AdvancedItem = ({ label, contentTitle, contentBody }) => (
        <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.surface }]}
            onPress={() => showModal(contentTitle, contentBody)}
        >
            <Text style={[styles.itemLabel, { color: theme.text }]}>{label}</Text>
            <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBg} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backButtonText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Advanced</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <AdvancedItem
                    label="About App"
                    contentTitle="About NEXALERT"
                    contentBody="NEXALERT v1.0.0\n\nA secure and efficient messaging application designed to keep you connected."
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <AdvancedItem
                    label="Terms & Conditions"
                    contentTitle="Terms & Conditions"
                    contentBody="1. User Conduct: behave responsibly.\n2. Privacy: we respect your data.\n3. Usage: for personal communication only.\n\n(Full terms would go here...)"
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <AdvancedItem
                    label="Privacy Policy"
                    contentTitle="Privacy Policy"
                    contentBody="We collect minimal data to provide this service. Your messages are stored locally or securely transmitted. We do not sell your data."
                />
            </View>

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>{modalContent.title}</Text>
                        <ScrollView style={{ marginBottom: 20 }}>
                            <Text style={[styles.modalText, { color: theme.textSecondary }]}>{modalContent.body}</Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: theme.primary }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.onPrimary }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
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
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    chevron: {
        fontSize: 24,
        fontWeight: '300',
    },
    divider: {
        height: 1,
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
        shadowOffset: {
            width: 0,
            height: 2,
        },
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
