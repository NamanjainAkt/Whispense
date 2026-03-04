// app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Text } from '../src/components/ui';
import { useTheme } from '../src/theme/useTheme';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="h2" center>
          This screen doesn't exist.
        </Text>
        <Link href="/" style={styles.link}>
          <Text variant="body" color="primary">
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
