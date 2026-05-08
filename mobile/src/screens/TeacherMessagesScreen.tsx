import { StyleSheet, Text } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";

export function TeacherMessagesScreen() {
  return (
    <AppScreen
      title="Messages"
      subtitle="Communication enseignant et annonces de classe"
    >
      <Card>
        <Text style={styles.title}>Messagerie enseignant</Text>
        <Text style={styles.body}>
          L'espace de communication est maintenant reserve dans la navigation enseignant.
          La prochaine etape sera de brancher les conversations, les annonces de classe
          et les badges non lus sur cette vue.
        </Text>
      </Card>

      <EmptyState
        title="Aucune conversation mobile"
        message="Le module messages enseignant n'est pas encore relie au backend, mais son emplacement est maintenant integre dans l'application."
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
});
