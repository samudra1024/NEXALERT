import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
    PermissionsAndroid,
    Platform,
    Alert
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';

const ProfilePhotoModal = ({ visible, onClose, onImageSelected }) => {
    const { theme } = useTheme();

    const requestCameraPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: 'Camera Permission',
                        message: 'App needs access to your camera to take profile photos.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const handleCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
            return;
        }

        const options = {
            mediaType: 'photo',
            quality: 0.8,
            maxWidth: 800,
            maxHeight: 800,
            saveToPhotos: true,
        };

        launchCamera(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled camera');
            } else if (response.errorCode) {
                console.log('Camera Error: ', response.errorMessage);
                Alert.alert('Error', 'Failed to launch camera.');
            } else if (response.assets && response.assets.length > 0) {
                const uri = response.assets[0].uri;
                onImageSelected(uri);
                onClose();
            }
        });
    };

    const handleGallery = () => {
        const options = {
            mediaType: 'photo',
            quality: 0.8,
            maxWidth: 800,
            maxHeight: 800,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.errorCode) {
                console.log('ImagePicker Error: ', response.errorMessage);
                Alert.alert('Error', 'Failed to open gallery.');
            } else if (response.assets && response.assets.length > 0) {
                const uri = response.assets[0].uri;
                onImageSelected(uri);
                onClose();
            }
        });
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <View style={styles.handle} />
                        <Text style={[styles.title, { color: theme.colors.text }]}>Change Profile Photo</Text>

                        <TouchableOpacity style={styles.option} onPress={handleCamera}>
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>📷 Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.option} onPress={handleGallery}>
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>🖼 Choose from Gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.option, styles.cancelOption]} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        elevation: 10,
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: '#ccc',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    option: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    optionText: {
        fontSize: 16,
    },
    cancelOption: {
        borderBottomWidth: 0,
        marginTop: 10,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        color: '#dc3545',
        fontWeight: '600',
    },
});

export default ProfilePhotoModal;
