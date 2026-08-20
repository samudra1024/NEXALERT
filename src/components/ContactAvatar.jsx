import React, { memo, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const avatarColors = [
  '#4285F4', '#EA4335', '#FBBC05', '#34A853',
  '#7B1FA2', '#E91E63', '#00ACC1', '#FF7043',
  '#5C6BC0', '#26A69A', '#8D6E63', '#78909C',
];

function hashName(name) {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getAvatarColor(name) {
  return avatarColors[hashName(name) % avatarColors.length];
}

export function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

const ContactAvatar = memo(function ContactAvatar({
  name,
  photoUri,
  size = 44,
  style,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const backgroundColor = useMemo(() => getAvatarColor(name), [name]);
  const initial = useMemo(() => getInitial(name), [name]);
  const radius = size / 2;

  const showImage = photoUri && !imageFailed;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius, backgroundColor },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: photoUri }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ContactAvatar;
