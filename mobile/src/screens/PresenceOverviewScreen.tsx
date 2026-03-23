import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { theme } from "@/constants/theme";
import { usePresenceBundle } from "@/hooks/useRoleFeeds";
import { useAuth } from "@/providers/AuthProvider";
import { loadTeacherAttendanceBundle } from "@/services/teacherPresence.service";

export function PresenceOverviewScreen() {
  const navigation = useNavigation<any>();
  const { activeRole, session } = useAuth();
  const { data, isLoading, refetch, isRefetching } = usePresenceBundle();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [feedSearch, setFeedSearch] = useState("");

  const teacherQuery = useQuery({
    queryKey: ["teacher-attendance-overview", session?.user.id, selectedCourseId],
    queryFn: () => loadTeacherAttendanceBundle(session!, selectedCourseId),
    enabled: activeRole === "ENSEIGNANT" && !!session,
  });

  const teacherMetrics = useMemo(() => {
    const students = teacherQuery.data?.students ?? [];
    const present = students.filter((item) => item.status === "PRESENT").length;
    const absent = students.filter((item) => item.status === "ABSENT").length;
    const late = students.filter((item) => item.status === "RETARD").length;
    const excused = students.filter((item) => item.status === "EXCUSE").length;
    return [
      { id: "total", label: "Eleves", value: String(students.length), tone: "primary" as const },
      { id: "present", label: "Presents", value: String(present), tone: "success" as const },
      { id: "absent", label: "Absents", value: String(absent), tone: "danger" as const },
      { id: "late", label: "Retards", value: String(late + excused), tone: "warning" as const },
    ];
  }, [teacherQuery.data?.students]);

  const feedItems = useMemo(() => {
    const query = feedSearch.trim().toLowerCase();
    if (!query) return data?.items ?? [];

    return (data?.items ?? []).filter((item) =>
      [item.title, item.subtitle, item.meta]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data?.items, feedSearch]);

  if (activeRole === "ENSEIGNANT") {
    return (
      <AppScreen
        title="Presences"
        subtitle="Vue d'ensemble des appels et du cours detecte pour aujourd'hui."
        refreshing={teacherQuery.isRefetching}
        onRefresh={() => {
          void teacherQuery.refetch();
        }}
        rightSlot={
          teacherQuery.data?.sessionStatus === "ready" ? (
            <Pressable
              onPress={() =>
                navigation.navigate("TeacherAttendanceSheet", {
                  selectedCourseId: teacherQuery.data?.selectedCourse?.id ?? selectedCourseId,
                })
              }
              style={styles.headerAction}
            >
              <Text style={styles.headerActionText}>Feuille</Text>
            </Pressable>
          ) : null
        }
      >
        {teacherQuery.isLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Cours detecte</Text>
              {teacherQuery.data?.selectedCourse ? (
                <View style={styles.courseBlock}>
                  <Text style={styles.courseTitle}>
                    {teacherQuery.data.selectedCourse.subjectName}
                  </Text>
                  <Text style={styles.courseSubtitle}>
                    {teacherQuery.data.selectedCourse.className}
                  </Text>
                  <Text style={styles.courseMeta}>
                    {teacherQuery.data.selectedCourse.slotLabel}
                  </Text>
                  <Text style={styles.courseMeta}>
                    {teacherQuery.data.selectedCourse.roomName}
                  </Text>
                  <View style={styles.sessionInlineMeta}>
                    <Text style={styles.sessionInlineMetaText}>
                      {teacherQuery.data.sessionId ? "Session prete" : "Session en attente"}
                    </Text>
                    <Text style={styles.sessionInlineMetaText}>
                      {teacherQuery.data.students.length} eleve(s)
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.mutedText}>
                  Aucun cours en cours n'a ete detecte sur l'appareil.
                </Text>
              )}
            </Card>

            {teacherQuery.data?.todayCourses.length ? (
              <Card>
                <Text style={styles.sectionTitle}>Seances du jour</Text>
                <View style={styles.courseSelectorList}>
                  {teacherQuery.data.todayCourses.map((course) => {
                    const selected = teacherQuery.data?.selectedCourse?.id === course.id;
                    return (
                      <Pressable
                        key={course.id}
                        onPress={() => setSelectedCourseId(course.id)}
                        style={[
                          styles.courseSelectorCard,
                          selected ? styles.courseSelectorCardActive : null,
                        ]}
                      >
                        <View style={styles.courseSelectorHeader}>
                          <Text
                            style={[
                              styles.courseSelectorTitle,
                              selected ? styles.courseSelectorTitleActive : null,
                            ]}
                          >
                            {course.subjectName}
                          </Text>
                          <View
                            style={[
                              styles.courseTimingBadge,
                              course.timingState === "current"
                                ? styles.courseTimingCurrent
                                : course.timingState === "upcoming"
                                  ? styles.courseTimingUpcoming
                                  : styles.courseTimingCompleted,
                            ]}
                          >
                            <Text style={styles.courseTimingText}>
                              {course.timingState === "current"
                                ? "En cours"
                                : course.timingState === "upcoming"
                                  ? "A venir"
                                  : "Passe"}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.courseSelectorMeta,
                            selected ? styles.courseSelectorMetaActive : null,
                          ]}
                        >
                          {course.className} | {course.slotLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            <View style={styles.metricsRow}>
              {teacherMetrics.map((item) => (
                <KpiCard key={item.id} item={item} />
              ))}
            </View>

            {teacherQuery.data?.sessionStatus === "ready" ? (
              <Card>
                <Text style={styles.sectionTitle}>Acces terrain</Text>
                <Text style={styles.mutedText}>
                  La feuille d'appel est maintenant separee de cette vue d'ensemble pour une saisie plus propre sur le terrain.
                </Text>
                <Pressable
                  onPress={() =>
                    navigation.navigate("TeacherAttendanceSheet", {
                      selectedCourseId: teacherQuery.data?.selectedCourse?.id ?? selectedCourseId,
                    })
                  }
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Ouvrir la feuille d'appel</Text>
                </Pressable>
              </Card>
            ) : (
              <EmptyState
                title="Feuille d'appel indisponible"
                message="La feuille s'ouvrira automatiquement quand une seance enseignant sera detectee."
              />
            )}
          </>
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={data?.title || "Presences"}
      subtitle={data?.subtitle || "Absences, retards et sessions"}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : feedItems.length ? (
        <View style={styles.list}>
          <Card>
            <Text style={styles.sectionTitle}>Recherche</Text>
            <TextInput
              value={feedSearch}
              onChangeText={setFeedSearch}
              placeholder="Rechercher dans les presences et justificatifs"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
            />
            <Text style={styles.helperText}>
              {feedItems.length} element(s) correspondent a la recherche.
            </Text>
          </Card>
          {feedItems.map((item) => (
            <Card key={item.id}>
              <View style={styles.feedHeader}>
                <Text style={styles.title}>{item.title}</Text>
                <View
                  style={[
                    styles.feedAccent,
                    item.accent === "danger"
                      ? styles.feedAccentDanger
                      : item.accent === "warning"
                        ? styles.feedAccentWarning
                        : item.accent === "success"
                          ? styles.feedAccentSuccess
                          : item.accent === "info"
                            ? styles.feedAccentInfo
                            : styles.feedAccentPrimary,
                  ]}
                />
              </View>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Aucune presence a afficher"
          message="Le flux de presences est vide pour ce role."
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
    alignSelf: "center",
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  courseBlock: {
    gap: 6,
  },
  courseSelectorList: {
    gap: theme.spacing.sm,
  },
  courseSelectorCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: 8,
  },
  courseSelectorCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  courseSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  courseSelectorTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  courseSelectorTitleActive: {
    color: theme.colors.primary,
  },
  courseSelectorMeta: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  courseSelectorMetaActive: {
    color: theme.colors.text,
  },
  courseTimingBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  courseTimingCurrent: {
    backgroundColor: "#dcfce7",
  },
  courseTimingUpcoming: {
    backgroundColor: "#dbeafe",
  },
  courseTimingCompleted: {
    backgroundColor: "#e2e8f0",
  },
  courseTimingText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.text,
    textTransform: "uppercase",
  },
  courseTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
  },
  courseSubtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  courseMeta: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  sessionInlineMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  sessionInlineMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  primaryButton: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
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
  helperText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  list: {
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  feedAccent: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
  },
  feedAccentPrimary: {
    backgroundColor: theme.colors.primary,
  },
  feedAccentSuccess: {
    backgroundColor: theme.colors.success,
  },
  feedAccentWarning: {
    backgroundColor: theme.colors.warning,
  },
  feedAccentDanger: {
    backgroundColor: theme.colors.danger,
  },
  feedAccentInfo: {
    backgroundColor: theme.colors.info,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  meta: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});
