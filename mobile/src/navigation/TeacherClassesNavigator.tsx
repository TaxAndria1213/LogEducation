import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TeacherClassDetailScreen } from "@/screens/TeacherClassDetailScreen";
import { TeacherClassesScreen } from "@/screens/TeacherClassesScreen";

const Stack = createNativeStackNavigator();

export function TeacherClassesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherClassesHome" component={TeacherClassesScreen} />
      <Stack.Screen name="TeacherClassDetail" component={TeacherClassDetailScreen} />
    </Stack.Navigator>
  );
}
