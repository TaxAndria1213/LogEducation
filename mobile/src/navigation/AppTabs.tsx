import type { ComponentType } from "react";
import Feather from "@expo/vector-icons/Feather";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ROLE_TABS } from "@/constants/roles";
import { theme } from "@/constants/theme";
import type { MobileTabKey } from "@/types/models";
import { useAuth } from "@/providers/AuthProvider";
import { AcademicsScreen } from "@/screens/AcademicsScreen";
import { AgendaScreen } from "@/screens/AgendaScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { OperationsScreen } from "@/screens/OperationsScreen";
import { PresenceNavigator } from "@/navigation/PresenceNavigator";
import { ProfileScreen } from "@/screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const screenMap: Record<
  MobileTabKey,
  {
    label: string;
    icon: keyof typeof Feather.glyphMap;
    component: ComponentType;
  }
> = {
  Home: { label: "Accueil", icon: "home", component: HomeScreen },
  Agenda: { label: "Agenda", icon: "calendar", component: AgendaScreen },
  Presence: { label: "Presences", icon: "check-square", component: PresenceNavigator },
  Academic: { label: "Etudes", icon: "book-open", component: AcademicsScreen },
  Operations: { label: "Operations", icon: "briefcase", component: OperationsScreen },
  Profile: { label: "Profil", icon: "user", component: ProfileScreen },
};

export function AppTabs() {
  const { activeRole } = useAuth();
  const tabs: MobileTabKey[] = activeRole
    ? ROLE_TABS[activeRole]
    : ["Home", "Profile"];

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const config = screenMap[route.name as MobileTabKey];
        return {
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            height: 70,
            paddingTop: 8,
            paddingBottom: 10,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ color, size }) => (
            <Feather name={config.icon} size={size} color={color} />
          ),
        };
      }}
    >
      {tabs.map((tabName) => {
        const config = screenMap[tabName];
        return (
          <Tab.Screen
            key={tabName}
            name={tabName}
            component={config.component}
            options={{ tabBarLabel: config.label }}
          />
        );
      })}
    </Tab.Navigator>
  );
}
