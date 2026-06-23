// src/components/OfflineIndicator.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Text } from './ui';
import { useTheme } from '../theme/useTheme';

export function OfflineIndicator() {
  const theme = useTheme();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Don't show anything if we don't know the state yet or if online
  if (isConnected === null || isConnected) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.warning }]}>
      <Text variant="caption" color="white" center>
        You're offline. Changes will sync when connected.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
