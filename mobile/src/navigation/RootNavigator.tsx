import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { theme } from "@/constants/theme";
import { AppTabs } from "@/navigation/AppTabs";
import { LoginScreen } from "@/screens/LoginScreen";
import { useAuth } from "@/providers/AuthProvider";

const Stack = createNativeStackNavigator();

function BootScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const { status } = useAuth();

  if (status === "booting") {
    return <BootScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === "authenticated" ? (
        <Stack.Screen name="AppTabs" component={AppTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
