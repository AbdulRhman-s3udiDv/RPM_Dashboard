import { DefaultTheme, ThemeProvider } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppDrawerContent } from "@/components/drawer-content";
import { LoginScreen } from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";

function DrawerNav() {
  const colors = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        headerShadowVisible: false,
        drawerType: "slide",
        overlayColor: "transparent",
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Drawer.Screen name="index" options={{ title: "Command Center" }} />
      <Drawer.Screen name="patients" options={{ title: "Patient Registry", headerShown: false }} />
      <Drawer.Screen name="alerts" options={{ title: "Alerts & Triage" }} />
      <Drawer.Screen name="communications" options={{ title: "Communications" }} />
      <Drawer.Screen name="billing" options={{ title: "Billing & Compliance" }} />
      <Drawer.Screen name="workflows" options={{ title: "Workflows" }} />
      <Drawer.Screen name="devices" options={{ title: "Devices", headerShown: false }} />
      <Drawer.Screen name="clinics" options={{ title: "Clinics", headerShown: false }} />
      <Drawer.Screen name="staff" options={{ title: "Staff" }} />
      <Drawer.Screen name="analytics" options={{ title: "Analytics" }} />
      <Drawer.Screen name="ai" options={{ title: "AI Assistant" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
    </Drawer>
  );
}

function AuthGate() {
  const colors = useTheme();
  const { session, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return session ? <DrawerNav /> : <LoginScreen />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <AuthGate />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
