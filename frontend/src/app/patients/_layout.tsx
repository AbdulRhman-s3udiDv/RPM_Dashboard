import { DrawerToggleButton } from 'expo-router/drawer';
import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

export default function PatientsLayout() {
  const colors = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.surface },
      }}>
      <Stack.Screen name="index" options={{ title: 'Patient Registry', headerLeft: () => <DrawerToggleButton tintColor={colors.text} /> }} />
      <Stack.Screen name="[patientId]" options={{ title: 'Patient' }} />
    </Stack>
  );
}
