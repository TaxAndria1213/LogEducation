import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useTeacherClasses } from "@/hooks/useTeacherMobile";

export function TeacherClassesScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading, refetch, isRefetching } = useTeacherClasses();

  return (
    <AppScreen
      title="Classes"
      subtitle={
        data?.academicYear?.name
          ? `Classes affectees sur ${data.academicYear.name}`
          : "Classes et matieres suivies"
      }
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : data?.items.length ? (
        <View style={styles.list}>
          {data.items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate("TeacherClassDetail", { courseId: item.courseId })}
            >
              <Card>
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>{item.className}</Text>
                    <Text style={styles.subtitle}>
                      {item.levelName} | {item.subjectName}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.studentCount} eleves</Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <Text style={styles.metric}>
                    Moyenne: {item.averageScore !== null ? `${item.averageScore.toFixed(2)}/20` : "N/A"}
                  </Text>
                  <Text style={styles.metric}>Evaluations: {item.evaluationCount}</Text>
                  <Text style={styles.metric}>Absences recentes: {item.recentAbsences}</Text>
                </View>

                {item.siteName ? <Text style={styles.helperText}>Site: {item.siteName}</Text> : null}

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={() => navigation.navigate("TeacherClassDetail", { courseId: item.courseId })}
                  >
                    <Text style={styles.secondaryButtonText}>Voir les eleves</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => navigation.getParent()?.navigate("PresenceFlow")}
                  >
                    <Text style={styles.primaryButtonText}>Faire l'appel</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Aucune classe affectee"
          message="Aucune classe n'est encore reliee a ce compte enseignant pour l'annee scolaire courante."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  badge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  metricsRow: {
    gap: 4,
  },
  metric: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  actionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
});
