import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TeacherEvaluationCreateScreen } from "@/screens/TeacherEvaluationCreateScreen";
import { TeacherGradeEntryScreen } from "@/screens/TeacherGradeEntryScreen";
import { TeacherNotesScreen } from "@/screens/TeacherNotesScreen";

const Stack = createNativeStackNavigator();

export function TeacherNotesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherNotesHome" component={TeacherNotesScreen} />
      <Stack.Screen name="TeacherEvaluationCreate" component={TeacherEvaluationCreateScreen} />
      <Stack.Screen name="TeacherGradeEntry" component={TeacherGradeEntryScreen} />
    </Stack.Navigator>
  );
}
