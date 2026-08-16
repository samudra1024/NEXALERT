import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ContactAvatar from './ContactAvatar';
import { formatPhoneNumber } from '../utils/contactUtils';

const ContactRow = memo(function ContactRow({
  item,
  theme,
  onPress,
}) {
  const displayName = item.name || formatPhoneNumber(item.id);
  const phoneNumber = formatPhoneNumber(item.phone || item.id);

  const handlePress = useCallback(() => {
    onPress(item.id, displayName);
  }, [onPress, item.id, displayName]);

  return (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      <ContactAvatar
        name={displayName}
        photoUri={item.photoUri}
        size={44}
        style={styles.avatarSpacing}
      />
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.contactNumber, { color: theme.textSecondary }]} numberOfLines={1}>
          {phoneNumber}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarSpacing: {
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactNumber: {
    fontSize: 14,
  },
});

export default ContactRow;
