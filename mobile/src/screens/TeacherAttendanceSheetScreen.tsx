import { useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import {
  closeTeacherAttendanceSession,
  loadTeacherAttendanceBundle,
  updateTeacherPresenceStatus,
} from "@/services/teacherPresence.service";
import type { TeacherAttendanceStudent } from "@/types/models";

type RouteParams = {
  selectedCourseId?: string | null;
};

const STATUS_OPTIONS: Array<{
  id: TeacherAttendanceStudent["status"];
  short: string;
  label: string;
}> = [
  { id: "PRESENT", short: "P", label: "Present" },
  { id: "ABSENT", short: "A", label: "Absent" },
  { id: "RETARD", short: "R", label: "Retard" },
  { id: "EXCUSE", short: "E", label: "Excuse" },
];

export function TeacherAttendanceSheetScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const { activeRole, session } = useAuth();
  const [selectedCourseId] = useState<string | null>(params.selectedCourseId ?? null);
  const [searchText, setSearchText] = useState("");

  const teacherQuery = useQuery({
    queryKey: ["teacher-attendance-sheet", session?.user.id, selectedCourseId],
    queryFn: () => loadTeacherAttendanceBundle(session!, selectedCourseId),
    enabled: activeRole === "ENSEIGNANT" && !!session,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      student,
      status,
    }: {
      student: TeacherAttendanceStudent;
      status: TeacherAttendanceStudent["status"];
    }) => {
      await updateTeacherPresenceStatus(student, status, teacherQuery.data?.selectedCourse ?? null);
    },
    onSuccess: async () => {
      await teacherQuery.refetch();
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await closeTeacherAttendanceSession(sessionId);
    },
    onSuccess: async () => {
      await teacherQuery.refetch();
      navigation.goBack();
    },
  });

  const visibleStudents = useMemo(() => {
    const students = teacherQuery.data?.students ?? [];
    const query = searchText.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [student.name, student.code].join(" ").toLowerCase().includes(query),
    );
  }, [searchText, teacherQuery.data?.students]);

  const summary = useMemo(() => {
    const students = teacherQuery.data?.students ?? [];
    return {
      total: students.length,
      present: students.filter((item) => item.status === "PRESENT").length,
      absent: students.filter((item) => item.status === "ABSENT").length,
      late: students.filter((item) => item.status === "RETARD").length,
      excused: students.filter((item) => item.status === "EXCUSE").length,
    };
  }, [teacherQuery.data?.students]);

  const handleCloseSession = () => {
    if (!teacherQuery.data?.sessionId) {
      return;
    }

    Alert.alert(
      "Cloturer l'appel",
      "Confirmer la cloture de cette feuille d'appel ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Cloturer",
          onPress: () => {
            closeSessionMutation.mutate(teacherQuery.data!.sessionId!);
          },
        },
      ],
    );
  };

  if (activeRole !== "ENSEIGNANT") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <EmptyState
            title="Feuille reservee a l'enseignant"
            message="Cette feuille d'appel mobile est disponible uniquement pour le role enseignant."
          />
        </View>
      </SafeAreaView>
    );
  }

  const activeCourse = teacherQuery.data?.selectedCourse ?? null;
  const headerTitle = activeCourse?.subjectName || "Feuille d'appel";
  const headerSubtitle = activeCourse
    ? [activeCourse.className, activeCourse.slotLabel, activeCourse.roomName]
        .filter(Boolean)
        .join(" | ")
    : "Saisie terrain";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Retour</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>
        </View>

        {teacherQuery.isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : teacherQuery.data?.sessionStatus !== "ready" || !teacherQuery.data?.selectedCourse ? (
          <EmptyState
            title="Aucune feuille disponible"
            message="Aucune seance d'appel active n'a ete detectee pour le moment."
          />
        ) : (
          <>
            <View style={styles.toolbar}>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Rechercher un eleve"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
              />
              <Text style={styles.helperText}>
                {visibleStudents.length}/{summary.total} eleve(s)
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colStudent]}>Eleve</Text>
              <View style={styles.statusHeaderRow}>
                {STATUS_OPTIONS.map((status) => (
                  <Text key={status.id} style={styles.statusHeaderText}>
                    {status.short}
                  </Text>
                ))}
              </View>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetList}>
                {visibleStudents.map((student, index) => {
                  const pending =
                    updateMutation.isPending &&
                    updateMutation.variables?.student.id === student.id;

                  return (
                    <View key={student.id} style={styles.sheetRow}>
                      <View style={styles.sheetStudentInfo}>
                        <Text style={styles.sheetStudentIndex}>{index + 1}.</Text>
                        <View style={styles.sheetStudentTextWrap}>
                          <Text style={styles.sheetStudentName}>{student.name}</Text>
                          <Text style={styles.sheetStudentCode}>
                            {student.code || "Code non renseigne"}
                          </Text>
                          {student.status === "RETARD" && student.minutesLate ? (
                            <Text style={styles.sheetStudentHint}>
                              {student.minutesLate} min de retard
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.sheetStatusRow}>
                        {STATUS_OPTIONS.map((status) => {
                          const selected = student.status === status.id;
                          return (
                            <Pressable
                              key={status.id}
                              disabled={pending || selected}
                              onPress={() =>
                                updateMutation.mutate({
                                  student,
                                  status: status.id,
                                })
                              }
                              style={[
                                styles.sheetStatusButton,
                                selected ? styles.sheetStatusButtonActive : null,
                                pending ? styles.sheetStatusButtonDisabled : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.sheetStatusButtonText,
                                  selected ? styles.sheetStatusButtonTextActive : null,
                                ]}
                              >
                                {status.short}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerSummary}>
                <Text style={styles.footerSummaryText}>
                  {summary.present}/{summary.total} presents
                </Text>
                <Text style={styles.footerSummaryText}>
                  {summary.absent} abs. | {summary.late} ret. | {summary.excused} exc.
                </Text>
              </View>
              <Pressable
                disabled={closeSessionMutation.isPending || !teacherQuery.data?.sessionId}
                onPress={handleCloseSession}
                style={[
                  styles.closeButton,
                  closeSessionMutation.isPending || !teacherQuery.data?.sessionId
                    ? styles.closeButtonDisabled
                    : null,
                ]}
              >
                <Text style={styles.closeButtonText}>
                  {closeSessionMutation.isPending ? "Cloture..." : "Cloturer l'appel"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  backButton: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    textTransform: "uppercase",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    gap: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
    ...theme.shadow.card,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
  },
  colStudent: {
    flex: 1,
  },
  statusHeaderRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusHeaderText: {
    width: 34,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textMuted,
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
  },
  scrollArea: {
    flex: 1,
  },
  sheetList: {
    gap: 10,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    ...theme.shadow.card,
  },
  sheetStudentInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sheetStudentIndex: {
    width: 24,
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textMuted,
  },
  sheetStudentTextWrap: {
    flex: 1,
    gap: 2,
  },
  sheetStudentName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  sheetStudentCode: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  sheetStudentHint: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.warning,
  },
  sheetStatusRow: {
    flexDirection: "row",
    gap: 8,
  },
  sheetStatusButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetStatusButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.chipActive,
  },
  sheetStatusButtonDisabled: {
    opacity: 0.55,
  },
  sheetStatusButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },
  sheetStatusButtonTextActive: {
    color: theme.colors.chipActiveText,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  footerSummary: {
    gap: 4,
  },
  footerSummaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  closeButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 15,
  },
  closeButtonDisabled: {
    opacity: 0.55,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
});
