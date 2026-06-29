import { DrawerToggleButton } from 'expo-router/drawer';
import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

export default function DevicesLayout() {
  const colors = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Devices', headerLeft: () => <DrawerToggleButton tintColor={colors.text} /> }} />
      <Stack.Screen name="orders" options={{ title: 'Device Orders' }} />
    </Stack>
  );
}
