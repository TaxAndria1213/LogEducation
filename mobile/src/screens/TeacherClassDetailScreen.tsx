import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { theme } from "@/constants/theme";
import { useTeacherClassDetail } from "@/hooks/useTeacherMobile";

type RouteParams = {
  courseId?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeacherClassDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { courseId } = (route.params ?? {}) as RouteParams;
  const { data, isLoading, refetch, isRefetching } = useTeacherClassDetail(courseId ?? null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "DIFFICULTY" | "ABSENCE">("ALL");

  const students = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (data?.students ?? []).filter((student) => {
      if (
        query &&
        ![student.fullName, student.code].join(" ").toLowerCase().includes(query)
      ) {
        return false;
      }

      if (filterMode === "DIFFICULTY" && !student.difficulty) {
        return false;
      }

      if (filterMode === "ABSENCE" && student.absences <= 0) {
        return false;
      }

      return true;
    });
  }, [data?.students, filterMode, search]);

  return (
    <AppScreen
      title={data?.class.className || "Detail classe"}
      subtitle={
        data
          ? `${data.class.levelName} | ${data.class.subjectName}`
          : "Eleves et suivi pedagogique"
      }
      refreshing={isRefetching}
      onRefresh={refetch}
      rightSlot={
        <Pressable onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Retour</Text>
        </Pressable>
      }
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : data ? (
        <>
          <View style={styles.metricsRow}>
            <KpiCard
              item={{
                id: "students",
                label: "Eleves",
                value: String(data.class.studentCount),
                tone: "primary",
              }}
            />
            <KpiCard
              item={{
                id: "evals",
                label: "Evaluations",
                value: String(data.class.evaluationCount),
                tone: "info",
              }}
            />
          </View>

          <View style={styles.metricsRow}>
            <KpiCard
              item={{
                id: "average",
                label: "Moyenne",
                value:
                  data.class.averageScore !== null
                    ? data.class.averageScore.toFixed(2)
                    : "N/A",
                tone: "success",
              }}
            />
            <KpiCard
              item={{
                id: "difficult",
                label: "En difficulte",
                value: String(data.students.filter((student) => student.difficulty).length),
                tone: "warning",
              }}
            />
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() =>
                navigation.getParent()?.navigate("Notes", {
                  screen: "TeacherNotesHome",
                  params: { initialClassName: data.class.className },
                })
              }
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Notes de la classe</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.getParent()?.navigate("Notes", {
                  screen: "TeacherEvaluationCreate",
                  params: { presetCourseId: data.class.courseId },
                })
              }
              style={[styles.actionButton, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>Nouvelle evaluation</Text>
            </Pressable>
          </View>

          <Card>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un eleve"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
            />
            <View style={styles.filterRow}>
              {[
                { id: "ALL", label: "Tous" },
                { id: "DIFFICULTY", label: "Moyenne faible" },
                { id: "ABSENCE", label: "Absences" },
              ].map((item) => {
                const active = item.id === filterMode;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setFilterMode(item.id as typeof filterMode)}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helperText}>{students.length} eleve(s) affiches</Text>
          </Card>

          {students.length ? (
            <View style={styles.list}>
              {students.map((student) => (
                <Card key={student.eleveId}>
                  <View style={styles.studentRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(student.fullName)}</Text>
                    </View>
                    <View style={styles.studentText}>
                      <Text style={styles.studentName}>{student.fullName}</Text>
                      <Text style={styles.studentMeta}>
                        {student.code || "Code non renseigne"}
                      </Text>
                      <Text style={styles.studentMeta}>
                        Moyenne: {student.averageScore !== null ? `${student.averageScore.toFixed(2)}/20` : "N/A"}
                      </Text>
                      <Text style={styles.studentMeta}>
                        Absences: {student.absences} | Retards: {student.retards}
                      </Text>
                    </View>
                    {student.difficulty ? (
                      <View style={styles.alertBadge}>
                        <Text style={styles.alertBadgeText}>A suivre</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Aucun eleve"
              message="Aucun eleve ne correspond aux filtres choisis."
            />
          )}
        </>
      ) : (
        <EmptyState
          title="Detail indisponible"
          message="Impossible de charger le detail de cette classe pour le moment."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
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
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  filterChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },
  filterTextActive: {
    color: theme.colors.primary,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  list: {
    gap: theme.spacing.sm,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  studentText: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  studentMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  alertBadge: {
    borderRadius: theme.radius.pill,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.warning,
    textTransform: "uppercase",
  },
});
