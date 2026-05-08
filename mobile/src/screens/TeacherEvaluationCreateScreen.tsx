import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import {
  useTeacherEvaluationDetail,
  useTeacherEvaluationFormOptions,
} from "@/hooks/useTeacherMobile";
import { queryClient } from "@/lib/query";
import {
  createTeacherEvaluation,
  updateTeacherEvaluation,
} from "@/services/teacherMobile.service";

type RouteParams = {
  evaluationId?: string;
  presetCourseId?: string;
};

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getPedagogicalItemLabel(item?: {
  nom: string;
  parent?: { nom: string } | null;
} | null) {
  if (!item) return "Aucun element pedagogique";
  const parent = item.parent?.nom?.trim() ?? "";
  const nom = item.nom?.trim() ?? "";
  if (parent && nom) return `${parent} > ${nom}`;
  return nom || "Element pedagogique";
}

function getGradingScaleLabel(item?: {
  nom: string;
  grading_type: string;
  base_score?: number | null;
} | null) {
  if (!item) return "Aucune echelle";
  const base =
    typeof item.base_score === "number" && Number.isFinite(item.base_score)
      ? ` / ${item.base_score}`
      : "";
  return `${item.nom} (${item.grading_type}${base})`;
}

export function TeacherEvaluationCreateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { evaluationId, presetCourseId } = (route.params ?? {}) as RouteParams;
  const isEditing = Boolean(evaluationId);
  const optionsQuery = useTeacherEvaluationFormOptions();
  const detailQuery = useTeacherEvaluationDetail(evaluationId ?? null);
  const options = optionsQuery.data;
  const detail = detailQuery.data;

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("DEVOIR");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [noteMax, setNoteMax] = useState("20");
  const [publishNow, setPublishNow] = useState(true);
  const [includeInAverage, setIncludeInAverage] = useState(true);
  const [showInReportCard, setShowInReportCard] = useState(false);
  const [isFinalExam, setIsFinalExam] = useState(false);
  const [selectedPedagogicalItemId, setSelectedPedagogicalItemId] = useState<string | null>(null);
  const [selectedGradingScaleId, setSelectedGradingScaleId] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      setSelectedCourseId(detail.cours_id);
      setSelectedPeriodId(detail.periode_id);
      setSelectedPedagogicalItemId(detail.pedagogical_item_id ?? null);
      setSelectedGradingScaleId(detail.grading_scale_id ?? null);
      setSelectedType(detail.type);
      setTitle(detail.titre);
      setDate(detail.date.slice(0, 10));
      setNoteMax(String(detail.note_max));
      setPublishNow(detail.est_publiee);
      setIncludeInAverage(detail.include_in_average ?? true);
      setShowInReportCard(detail.show_in_report_card ?? false);
      setIsFinalExam(detail.is_final_exam ?? false);
      return;
    }

    if (!detail && presetCourseId) {
      setSelectedCourseId((current) => current ?? presetCourseId);
    }
  }, [detail, presetCourseId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cours_id: selectedCourseId!,
        periode_id: selectedPeriodId!,
        pedagogical_item_id: selectedPedagogicalItemId,
        grading_scale_id: selectedGradingScaleId,
        titre: title,
        date,
        type: selectedType,
        note_max: Number(noteMax),
        est_publiee: publishNow,
        include_in_average: includeInAverage,
        show_in_report_card: showInReportCard,
        is_final_exam: isFinalExam,
      };

      if (evaluationId) {
        return updateTeacherEvaluation(evaluationId, payload);
      }

      return createTeacherEvaluation(payload);
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-notes-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-grade-sheet"] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-mobile-evaluation-detail"] }),
      ]);
      Alert.alert("Succes", isEditing ? "Evaluation mise a jour avec succes." : "Evaluation creee avec succes.");
      if (evaluationId) {
        navigation.goBack();
        return;
      }
      navigation.replace("TeacherGradeEntry", { evaluationId: data.id });
    },
    onError: (error) => {
      Alert.alert("Erreur", error instanceof Error ? error.message : "Operation impossible.");
    },
  });

  const selectedCourseLabel = useMemo(() => {
    const course = options?.courses.find((item) => item.id === selectedCourseId);
    return course ? `${course.className} | ${course.subjectName}` : "Choisir un cours";
  }, [options?.courses, selectedCourseId]);

  const selectedPeriodLabel = useMemo(() => {
    const period = options?.periods.find((item) => item.id === selectedPeriodId);
    return period?.nom?.trim() || "Choisir une periode";
  }, [options?.periods, selectedPeriodId]);
  const selectedCourse = useMemo(
    () => options?.courses.find((item) => item.id === selectedCourseId) ?? null,
    [options?.courses, selectedCourseId],
  );
  const filteredPedagogicalItems = useMemo(() => {
    if (!options) return [];
    if (!selectedCourse) return options.pedagogicalItems;

    return options.pedagogicalItems.filter((item) => {
      const sameLevel =
        !item.niveau_scolaire_id || item.niveau_scolaire_id === selectedCourse.levelId;
      const sameSubject =
        !item.matiere_id || item.matiere_id === selectedCourse.subjectId;
      return sameLevel && sameSubject;
    });
  }, [options, selectedCourse]);
  const selectedPedagogicalItem = useMemo(
    () =>
      filteredPedagogicalItems.find((item) => item.id === selectedPedagogicalItemId) ?? null,
    [filteredPedagogicalItems, selectedPedagogicalItemId],
  );
  const selectedGradingScale = useMemo(
    () => options?.gradingScales.find((item) => item.id === selectedGradingScaleId) ?? null,
    [options?.gradingScales, selectedGradingScaleId],
  );

  useEffect(() => {
    if (
      selectedPedagogicalItemId &&
      !filteredPedagogicalItems.some((item) => item.id === selectedPedagogicalItemId)
    ) {
      setSelectedPedagogicalItemId(null);
    }
  }, [filteredPedagogicalItems, selectedPedagogicalItemId]);

  const handleSave = () => {
    if (!selectedCourseId || !selectedPeriodId) {
      Alert.alert("Champs requis", "Le cours et la periode sont obligatoires.");
      return;
    }

    saveMutation.mutate();
  };

  const isLoading = optionsQuery.isLoading || (isEditing && detailQuery.isLoading);

  return (
    <AppScreen
      title={isEditing ? "Modifier evaluation" : "Nouvelle evaluation"}
      subtitle={isEditing ? "Edition rapide d'une evaluation mobile" : "Creation rapide d'une evaluation mobile"}
      rightSlot={
        <Pressable onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Fermer</Text>
        </Pressable>
      }
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : options ? (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Devoir maison 2"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.sectionTitle}>Date</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2026-05-05"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.sectionTitle}>Note maximale</Text>
            <TextInput
              value={noteMax}
              onChangeText={setNoteMax}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Cours</Text>
            <Text style={styles.helper}>{selectedCourseLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.choiceRow}>
                {options.courses.map((course) => {
                  const active = course.id === selectedCourseId;
                  return (
                    <Pressable
                      key={course.id}
                      onPress={() => setSelectedCourseId(course.id)}
                      style={[styles.choiceChip, active ? styles.choiceChipActive : null]}
                    >
                      <Text style={[styles.choiceText, active ? styles.choiceTextActive : null]}>
                        {course.className}
                      </Text>
                      <Text style={[styles.choiceSubtext, active ? styles.choiceSubtextActive : null]}>
                        {course.subjectName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Periode</Text>
            <Text style={styles.helper}>{selectedPeriodLabel}</Text>
            <View style={styles.blockList}>
              {options.periods.map((period) => {
                const active = period.id === selectedPeriodId;
                return (
                  <Pressable
                    key={period.id}
                    onPress={() => setSelectedPeriodId(period.id)}
                    style={[styles.blockItem, active ? styles.blockItemActive : null]}
                  >
                    <Text style={[styles.blockTitle, active ? styles.blockTitleActive : null]}>
                      {period.nom || "Periode"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Element pedagogique</Text>
            <Text style={styles.helper}>
              {selectedPedagogicalItem
                ? getPedagogicalItemLabel(selectedPedagogicalItem)
                : "Optionnel, selon le cours choisi"}
            </Text>
            <View style={styles.blockList}>
              <Pressable
                onPress={() => setSelectedPedagogicalItemId(null)}
                style={[
                  styles.blockItem,
                  selectedPedagogicalItemId === null ? styles.blockItemActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.blockTitle,
                    selectedPedagogicalItemId === null ? styles.blockTitleActive : null,
                  ]}
                >
                  Aucun element pedagogique
                </Text>
              </Pressable>

              {filteredPedagogicalItems.map((item) => {
                const active = item.id === selectedPedagogicalItemId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedPedagogicalItemId(item.id)}
                    style={[styles.blockItem, active ? styles.blockItemActive : null]}
                  >
                    <Text style={[styles.blockTitle, active ? styles.blockTitleActive : null]}>
                      {getPedagogicalItemLabel(item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Echelle de notation</Text>
            <Text style={styles.helper}>
              {selectedGradingScale
                ? getGradingScaleLabel(selectedGradingScale)
                : "Optionnel, pour preparer la notation multi-format"}
            </Text>
            <View style={styles.blockList}>
              <Pressable
                onPress={() => setSelectedGradingScaleId(null)}
                style={[
                  styles.blockItem,
                  selectedGradingScaleId === null ? styles.blockItemActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.blockTitle,
                    selectedGradingScaleId === null ? styles.blockTitleActive : null,
                  ]}
                >
                  Aucune echelle specifique
                </Text>
              </Pressable>

              {options.gradingScales.map((item) => {
                const active = item.id === selectedGradingScaleId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedGradingScaleId(item.id)}
                    style={[styles.blockItem, active ? styles.blockItemActive : null]}
                  >
                    <Text style={[styles.blockTitle, active ? styles.blockTitleActive : null]}>
                      {getGradingScaleLabel(item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.choiceRowWrap}>
              {options.typeOptions.map((type) => {
                const active = type.value === selectedType;
                return (
                  <Pressable
                    key={type.value}
                    onPress={() => setSelectedType(type.value)}
                    style={[styles.typeChip, active ? styles.typeChipActive : null]}
                  >
                    <Text style={[styles.typeText, active ? styles.typeTextActive : null]}>
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setPublishNow((value) => !value)}
              style={[styles.toggleRow, publishNow ? styles.toggleRowActive : null]}
            >
              <Text style={styles.toggleTitle}>Publier immediatement</Text>
              <Text style={styles.toggleValue}>{publishNow ? "Oui" : "Non"}</Text>
            </Pressable>

            <Pressable
              onPress={() => setIncludeInAverage((value) => !value)}
              style={[styles.toggleRow, includeInAverage ? styles.toggleRowActive : null]}
            >
              <Text style={styles.toggleTitle}>Inclure dans la moyenne</Text>
              <Text style={styles.toggleValue}>{includeInAverage ? "Oui" : "Non"}</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowInReportCard((value) => !value)}
              style={[styles.toggleRow, showInReportCard ? styles.toggleRowActive : null]}
            >
              <Text style={styles.toggleTitle}>Visible dans le bulletin</Text>
              <Text style={styles.toggleValue}>{showInReportCard ? "Oui" : "Non"}</Text>
            </Pressable>

            <Pressable
              onPress={() => setIsFinalExam((value) => !value)}
              style={[styles.toggleRow, isFinalExam ? styles.toggleRowActive : null]}
            >
              <Text style={styles.toggleTitle}>Examen final / composition</Text>
              <Text style={styles.toggleValue}>{isFinalExam ? "Oui" : "Non"}</Text>
            </Pressable>
          </Card>

          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={[styles.primaryButton, saveMutation.isPending ? styles.primaryButtonDisabled : null]}
          >
            <Text style={styles.primaryButtonText}>
              {saveMutation.isPending
                ? "Enregistrement..."
                : isEditing
                  ? "Mettre a jour l'evaluation"
                  : "Creer l'evaluation"}
            </Text>
          </Pressable>
        </>
      ) : (
        <Card>
          <Text style={styles.errorText}>Impossible de charger les options du formulaire.</Text>
        </Card>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  helper: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
  },
  choiceRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  choiceRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  choiceChip: {
    minWidth: 140,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: 4,
  },
  choiceChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  choiceTextActive: {
    color: theme.colors.primary,
  },
  choiceSubtext: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  choiceSubtextActive: {
    color: theme.colors.text,
  },
  blockList: {
    gap: theme.spacing.sm,
  },
  blockItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
  },
  blockItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  blockTitleActive: {
    color: theme.colors.primary,
  },
  typeChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  typeText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },
  typeTextActive: {
    color: theme.colors.primary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  toggleRowActive: {
    borderColor: theme.colors.primary,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  toggleValue: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary,
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
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.danger,
  },
});
