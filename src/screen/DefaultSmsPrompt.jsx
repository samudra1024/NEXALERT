import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  AppState,
} from 'react-native';
import SmsController from '../../Controller/SmsController';

export default function DefaultSmsPrompt({ visible, onClose, onSuccess }) {
  const [checking, setChecking] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);

  const checkDefaultStatus = useCallback(async () => {
    try {
      const defaultStatus = await SmsController.isDefaultSmsApp();
      setIsDefault(defaultStatus);
      if (defaultStatus && awaitingRole) {
        setAwaitingRole(false);
        setChecking(false);
        onSuccess();
      }
      return defaultStatus;
    } catch (error) {
      console.error('Error checking default status:', error);
      return false;
    }
  }, [awaitingRole, onSuccess]);

  useEffect(() => {
    if (visible) {
      checkDefaultStatus();
    }
  }, [visible, checkDefaultStatus]);

  useEffect(() => {
    if (!awaitingRole) return undefined;

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkDefaultStatus();
      }
    });

    return () => subscription.remove();
  }, [awaitingRole, checkDefaultStatus]);

  const handleSetDefault = async () => {
    try {
      setChecking(true);
      setAwaitingRole(true);
      await SmsController.requestDefaultSmsApp();

      // Immediate check — works when already default or instant grant
      const immediate = await checkDefaultStatus();
      if (immediate) return;

      // Poll briefly after system dialog
      const pollDelays = [500, 1000, 2000];
      for (const delay of pollDelays) {
        await new Promise(resolve => setTimeout(resolve, delay));
        const granted = await checkDefaultStatus();
        if (granted) return;
      }

      setChecking(false);
      setAwaitingRole(false);
      Alert.alert(
        'Set as Default SMS App',
        'Please select NexAlert in the system dialog. You can also open Settings to set it manually.',
        [
          { text: 'Try Again', onPress: handleSetDefault },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await SmsController.openSmsAppSettings();
              } catch (settingsError) {
                console.error('Error opening settings:', settingsError);
              }
              setChecking(false);
            },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => setChecking(false) },
        ],
      );
    } catch (error) {
      console.error('Error requesting default SMS app:', error);
      Alert.alert('Error', 'Could not open the default SMS app dialog. Please try again.');
      setChecking(false);
      setAwaitingRole(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Set as Default SMS App</Text>
          <Text style={styles.message}>
            To receive and send SMS, NexAlert needs to be your default SMS application.
          </Text>

          <View style={[styles.statusBadge, isDefault ? styles.statusSuccess : styles.statusPending]}>
            <Text style={styles.statusText}>
              {isDefault ? '✓ NexAlert is your default SMS app' : 'Not set as default yet'}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={checking}
            >
              <Text style={styles.cancelText}>Later</Text>
            </TouchableOpacity>

            {!isDefault && (
              <TouchableOpacity
                style={styles.setButton}
                onPress={handleSetDefault}
                disabled={checking}
              >
                <Text style={styles.setText}>
                  {checking ? 'Opening...' : 'Set as Default'}
                </Text>
              </TouchableOpacity>
            )}
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
    marginBottom: 16,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
