import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import SmsController from '../../Controller/SmsController';

export default function DefaultSmsPrompt({ visible, onClose, onSuccess }) {
  const [checking, setChecking] = useState(false);

  const handleSetDefault = async () => {
    try {
      setChecking(true);
      
      // Request default SMS app using RoleManager
      await SmsController.requestDefaultSmsApp();
      
      // Check after a delay to see if user accepted
      setTimeout(async () => {
        try {
          const isDefault = await SmsController.isDefaultSmsApp();
          if (isDefault) {
            onSuccess();
          } else {
            Alert.alert(
              'Set as Default SMS App', 
              'Please select this app in the system dialog. If no dialog appeared, the app may not meet all requirements.',
              [
                { text: 'Try Again', onPress: handleSetDefault },
                { text: 'Open Settings', onPress: async () => {
                  try {
                    await SmsController.openSmsAppSettings();
                  } catch (settingsError) {
                    console.error('Error opening settings:', settingsError);
                  }
                  setChecking(false);
                }},
                { text: 'Cancel', onPress: () => setChecking(false) }
              ]
            );
          }
        } catch (error) {
          console.error('Error checking default status:', error);
          Alert.alert('Error', 'Failed to verify default SMS app status.');
          setChecking(false);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error requesting default SMS app:', error);
      Alert.alert('Error', 'Failed to request default SMS app: ' + error.message);
      setChecking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Set as Default SMS App</Text>
          <Text style={styles.message}>
            To provide the best SMS experience, please set this app as your default SMS application in Settings.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onClose}
              disabled={checking}
            >
              <Text style={styles.cancelText}>Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.setButton} 
              onPress={handleSetDefault}
              disabled={checking}
            >
              <Text style={styles.setText}>
                {checking ? 'Requesting...' : 'Set as Default'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 320,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    textAlign: 'center',
  },
  setButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  setText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
});