import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useTeacherGradeSheet } from "@/hooks/useTeacherMobile";
import { queryClient } from "@/lib/query";
import {
  deleteTeacherEvaluation,
  saveTeacherGradeSheet,
  validateTeacherGradeSheet,
} from "@/services/teacherMobile.service";

type RouteParams = {
  evaluationId?: string;
};

type EditableStudent = {
  eleveId: string;
  fullName: string;
  code: string;
  scoreText: string;
  status: string;
  scaleLevelId: string | null;
  textValue: string;
  displayValue: string;
  comment: string;
};

const RESULT_STATUS_OPTIONS = [
  { value: "GRADED", label: "Note" },
  { value: "NOT_EVALUATED", label: "Non evalue" },
  { value: "JUSTIFIED_ABSENCE", label: "Abs. just." },
  { value: "UNJUSTIFIED_ABSENCE", label: "Abs. non just." },
  { value: "EXEMPTED", label: "Dispense" },
  { value: "NOT_SUBMITTED", label: "Non rendu" },
];

export function TeacherGradeEntryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { evaluationId } = (route.params ?? {}) as RouteParams;
  const gradeSheetQuery = useTeacherGradeSheet(evaluationId ?? null);
  const gradeSheet = gradeSheetQuery.data;
  const [students, setStudents] = useState<EditableStudent[]>([]);

  useEffect(() => {
    if (!gradeSheet) return;
    setStudents(
      gradeSheet.students.map((student) => ({
        eleveId: student.eleveId,
        fullName: student.fullName,
        code: student.code,
        scoreText: student.score === null ? "" : String(student.score),
        status: student.status || "NOT_EVALUATED",
        scaleLevelId: student.scaleLevelId ?? null,
        textValue: student.textValue ?? "",
        displayValue: student.displayValue ?? "",
        comment: student.comment || "",
      })),
    );
  }, [gradeSheet]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      saveTeacherGradeSheet(
        evaluationId!,
        students.map((student) => ({
          eleveId: student.eleveId,
          score: student.scoreText.trim() ? Number(student.scoreText) : null,
          status: student.status,
          scaleLevelId: student.scaleLevelId,
          textValue: student.textValue.trim() || null,
          comment: student.comment,
        })),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-grade-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-notes-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-dashboard"] }),
      ]);
      Alert.alert("Succes", "Notes enregistrees avec succes.");
    },
    onError: (error) => {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Enregistrement impossible.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => deleteTeacherEvaluation(evaluationId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-notes-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-grade-sheet"] }),
      ]);
      Alert.alert("Succes", "Evaluation supprimee avec succes.");
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Suppression impossible.");
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => validateTeacherGradeSheet(evaluationId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-grade-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-notes-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-evaluation-detail"] }),
      ]);
      Alert.alert("Succes", "Resultats valides avec succes.");
    },
    onError: (error) => {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Validation impossible.");
    },
  });

  const enteredCount = useMemo(
    () =>
      students.filter((student) => {
        if (student.status !== "GRADED") return true;
        if (gradeSheet?.evaluation.gradingType === "DESCRIPTIVE") {
          return student.textValue.trim().length > 0;
        }
        if (
          gradeSheet?.evaluation.gradingType === "LETTER" ||
          gradeSheet?.evaluation.gradingType === "LEVEL" ||
          gradeSheet?.evaluation.gradingType === "VALIDATION"
        ) {
          return Boolean(student.scaleLevelId);
        }
        return student.scoreText.trim().length > 0;
      }).length,
    [gradeSheet?.evaluation.gradingType, students],
  );

  const gradingType = gradeSheet?.evaluation.gradingType ?? "POINTS";
  const gradingLevels = gradeSheet?.evaluation.gradingLevels ?? [];
  const isEvaluationLocked =
    gradeSheet?.evaluation.workflowStatus === "VALIDATED" ||
    gradeSheet?.evaluation.workflowStatus === "LOCKED" ||
    gradeSheet?.evaluation.workflowStatus === "ARCHIVED";

  const updateStudent = (eleveId: string, patch: Partial<EditableStudent>) => {
    setStudents((current) =>
      current.map((student) =>
        student.eleveId === eleveId ? { ...student, ...patch } : student,
      ),
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer l'evaluation",
      "La suppression est possible seulement si aucune note n'est enregistree. Confirmer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  return (
    <AppScreen
      title={gradeSheet?.evaluation.title || "Feuille de notes"}
      subtitle={
        gradeSheet
          ? `${gradeSheet.evaluation.className} | ${gradeSheet.evaluation.subjectName}`
          : "Saisie des notes"
      }
      rightSlot={
        <Pressable onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Retour</Text>
        </Pressable>
      }
    >
      {gradeSheetQuery.isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : gradeSheet ? (
        <>
          <Card>
            <Text style={styles.summaryTitle}>{gradeSheet.evaluation.periodName}</Text>
            <Text style={styles.summaryMeta}>
              {enteredCount}/{students.length} notes saisies | max {gradeSheet.evaluation.noteMax}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${students.length ? Math.round((enteredCount / students.length) * 100) : 0}%` },
                ]}
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() =>
                  navigation.navigate("TeacherEvaluationCreate", { evaluationId })
                }
                disabled={isEvaluationLocked}
                style={[
                  styles.secondaryButton,
                  styles.actionButton,
                  isEvaluationLocked ? styles.buttonDisabled : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Editer l'evaluation</Text>
              </Pressable>
              <Pressable
                onPress={() => validateMutation.mutate()}
                disabled={validateMutation.isPending || isEvaluationLocked}
                style={[
                  styles.primaryGhostButton,
                  styles.actionButton,
                  validateMutation.isPending || isEvaluationLocked ? styles.buttonDisabled : null,
                ]}
              >
                <Text style={styles.primaryGhostButtonText}>
                  {isEvaluationLocked
                    ? "Resultats valides"
                    : validateMutation.isPending
                      ? "Validation..."
                      : "Valider les resultats"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleteMutation.isPending || isEvaluationLocked}
                style={[styles.dangerButton, styles.actionButton, deleteMutation.isPending ? styles.buttonDisabled : null]}
              >
                <Text style={styles.dangerButtonText}>
                  {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
                </Text>
              </Pressable>
            </View>
          </Card>

          {students.length ? (
            <View style={styles.list}>
              {students.map((student, index) => (
                <Card key={student.eleveId}>
                  <Text style={styles.studentName}>
                    {index + 1}. {student.fullName}
                  </Text>
                  <Text style={styles.studentCode}>{student.code || "Code non renseigne"}</Text>

                  <View style={styles.statusRow}>
                    {RESULT_STATUS_OPTIONS.map((statusOption) => {
                      const active = student.status === statusOption.value;
                      return (
                        <Pressable
                          key={`${student.eleveId}-${statusOption.value}`}
                          onPress={() => updateStudent(student.eleveId, { status: statusOption.value })}
                          disabled={isEvaluationLocked}
                          style={[styles.statusChip, active ? styles.statusChipActive : null]}
                        >
                          <Text style={[styles.statusChipText, active ? styles.statusChipTextActive : null]}>
                            {statusOption.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {student.status === "GRADED" &&
                  (gradingType === "POINTS" || gradingType === "PERCENTAGE") ? (
                    <TextInput
                      value={student.scoreText}
                      onChangeText={(value) => updateStudent(student.eleveId, { scoreText: value })}
                      keyboardType="numeric"
                      editable={!isEvaluationLocked}
                      placeholder={`Note / ${gradeSheet.evaluation.noteMax}`}
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.scoreInput}
                    />
                  ) : null}

                  {student.status === "GRADED" &&
                  (gradingType === "LETTER" ||
                    gradingType === "LEVEL" ||
                    gradingType === "VALIDATION") ? (
                    <View style={styles.levelRow}>
                      {gradingLevels.map((level) => {
                        const active = student.scaleLevelId === level.id;
                        return (
                          <Pressable
                            key={`${student.eleveId}-${level.id}`}
                            onPress={() =>
                              updateStudent(student.eleveId, {
                                scaleLevelId: active ? null : level.id,
                                displayValue: active ? "" : level.label || level.code,
                              })
                            }
                            disabled={isEvaluationLocked}
                            style={[styles.levelChip, active ? styles.levelChipActive : null]}
                          >
                            <Text style={[styles.levelChipText, active ? styles.levelChipTextActive : null]}>
                              {level.code}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {student.status === "GRADED" && gradingType === "DESCRIPTIVE" ? (
                    <TextInput
                      value={student.textValue}
                      onChangeText={(value) => updateStudent(student.eleveId, { textValue: value })}
                      editable={!isEvaluationLocked}
                      placeholder="Resultat descriptif"
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.commentInput}
                      multiline
                    />
                  ) : null}

                  <TextInput
                    value={student.comment}
                    onChangeText={(value) => updateStudent(student.eleveId, { comment: value })}
                    editable={!isEvaluationLocked}
                    placeholder="Observation courte"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.commentInput}
                    multiline
                  />
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Aucun eleve a noter"
              message="Aucun eleve inscrit n'a ete trouve pour cette evaluation."
            />
          )}

          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isEvaluationLocked}
            style={[
              styles.primaryButton,
              saveMutation.isPending || isEvaluationLocked ? styles.primaryButtonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isEvaluationLocked
                ? "Evaluation verrouillee"
                : saveMutation.isPending
                  ? "Enregistrement..."
                  : "Enregistrer les notes"}
            </Text>
          </Pressable>
        </>
      ) : (
        <EmptyState
          title="Feuille indisponible"
          message="Impossible de charger cette evaluation ou elle n'est pas accessible."
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  summaryMeta: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  progressBar: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
  },
  list: {
    gap: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: theme.radius.md,
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
  primaryGhostButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  primaryGhostButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  studentName: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  studentCode: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  statusChipTextActive: {
    color: theme.colors.primary,
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  levelChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  levelChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
  levelChipTextActive: {
    color: theme.colors.primary,
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  commentInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    textAlignVertical: "top",
  },
  primaryButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
});
