import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useTeacherClasses } from "@/hooks/useTeacherMobile";
import type { TeacherClassAssignment } from "@/types/models";

type TeacherClassGroup = {
  id: string;
  classId: string;
  className: string;
  levelName: string;
  siteName?: string | null;
  studentCount: number;
  courses: TeacherClassAssignment[];
};

export function TeacherClassesScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading, refetch, isRefetching } = useTeacherClasses();
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const groupedClasses = useMemo<TeacherClassGroup[]>(() => {
    const groups = new Map<string, TeacherClassGroup>();

    (data?.items ?? []).forEach((item) => {
      const existing = groups.get(item.classId);
      if (existing) {
        existing.courses.push(item);
        return;
      }

      groups.set(item.classId, {
        id: item.classId,
        classId: item.classId,
        className: item.className,
        levelName: item.levelName,
        siteName: item.siteName ?? null,
        studentCount: item.studentCount,
        courses: [item],
      });
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        courses: [...group.courses].sort((left, right) =>
          left.subjectName.localeCompare(right.subjectName, "fr", {
            sensitivity: "base",
          }),
        ),
      }))
      .sort((left, right) => {
        const leftLabel = `${left.levelName} ${left.className}`.trim();
        const rightLabel = `${right.levelName} ${right.className}`.trim();
        return leftLabel.localeCompare(rightLabel, "fr", { sensitivity: "base" });
      });
  }, [data?.items]);

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
      ) : groupedClasses.length ? (
        <View style={styles.list}>
          {groupedClasses.map((group) => (
            <Card key={group.id}>
              <Pressable
                onPress={() =>
                  setExpandedGroupId((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                style={styles.groupToggle}
              >
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>{group.className}</Text>
                    <Text style={styles.subtitle}>{group.levelName}</Text>
                    {group.siteName ? (
                      <Text style={styles.helperText}>Site: {group.siteName}</Text>
                    ) : null}
                  </View>
                  <View style={styles.groupBadges}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{group.studentCount} eleves</Text>
                    </View>
                    <View style={[styles.badge, styles.badgeNeutral]}>
                      <Text style={[styles.badgeText, styles.badgeNeutralText]}>
                        {group.courses.length} cours
                      </Text>
                    </View>
                    <Text style={styles.chevronText}>
                      {expandedGroupId === group.id ? "Replier" : "Deplier"}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {expandedGroupId === group.id ? (
                <>
                  <View style={styles.groupSummaryRow}>
                    <Text style={styles.groupSummaryText}>
                      Choisis le cours voulu dans cette classe.
                    </Text>
                  </View>

                  <View style={styles.courseList}>
                    {group.courses.map((course) => (
                      <View key={course.id} style={styles.courseCard}>
                        <View style={styles.courseHeader}>
                          <View style={styles.courseHeaderText}>
                            <Text style={styles.courseTitle}>{course.subjectName}</Text>
                            <Text style={styles.courseSubtitle}>
                              {course.evaluationCount} evaluation(s) | {course.recentAbsences} absence(s) recente(s)
                            </Text>
                          </View>
                          <View style={styles.courseAverageBadge}>
                            <Text style={styles.courseAverageValue}>
                              {course.averageScore !== null
                                ? `${course.averageScore.toFixed(2)}/20`
                                : "N/A"}
                            </Text>
                            <Text style={styles.courseAverageLabel}>Moyenne</Text>
                          </View>
                        </View>

                        <View style={styles.actionsRow}>
                          <Pressable
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={() =>
                              navigation.navigate("TeacherClassDetail", {
                                courseId: course.courseId,
                              })
                            }
                          >
                            <Text style={styles.secondaryButtonText}>Ouvrir le cours</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.actionButton, styles.primaryButton]}
                            onPress={() => navigation.getParent()?.navigate("PresenceFlow")}
                          >
                            <Text style={styles.primaryButtonText}>Faire l'appel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </Card>
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
  groupToggle: {
    borderRadius: theme.radius.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  groupBadges: {
    alignItems: "flex-end",
    gap: 8,
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
  badgeNeutral: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  badgeNeutralText: {
    color: theme.colors.text,
  },
  chevronText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  groupSummaryRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  groupSummaryText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  courseList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  courseCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  courseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  courseHeaderText: {
    flex: 1,
    gap: 4,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  courseSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  courseAverageBadge: {
    minWidth: 72,
    borderRadius: theme.radius.md,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
  },
  courseAverageValue: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  courseAverageLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
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
