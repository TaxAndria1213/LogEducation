import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PresenceOverviewScreen } from "@/screens/PresenceOverviewScreen";
import { TeacherAttendanceSheetScreen } from "@/screens/TeacherAttendanceSheetScreen";

const Stack = createNativeStackNavigator();

export function PresenceNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PresenceOverview" component={PresenceOverviewScreen} />
      <Stack.Screen
        name="TeacherAttendanceSheet"
        component={TeacherAttendanceSheetScreen}
      />
    </Stack.Navigator>
  );
}
