import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export function SkeletonBox({ width, height, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function ChatListSkeleton({ count = 8, theme }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.row, { backgroundColor: theme?.background || '#fff' }]}>
          <SkeletonBox width={52} height={52} borderRadius={26} />
          <View style={styles.rowContent}>
            <SkeletonBox width="55%" height={16} borderRadius={4} />
            <SkeletonBox width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
          <SkeletonBox width={40} height={12} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

export function MessageSkeleton({ count = 6, theme }) {
  return (
    <View style={styles.messageList}>
      {Array.from({ length: count }).map((_, index) => {
        const isMe = index % 2 === 0;
        return (
          <View
            key={index}
            style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
          >
            <SkeletonBox
              width={isMe ? 180 : 220}
              height={48}
              borderRadius={16}
              style={{ backgroundColor: theme?.surface || '#e5e7eb' }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e5e7eb',
  },
  list: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 80,
  },
  rowContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageRowMe: {
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignItems: 'flex-start',
  },
});
