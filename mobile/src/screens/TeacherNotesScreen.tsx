import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { theme } from "@/constants/theme";
import { useTeacherNotesOverview } from "@/hooks/useTeacherMobile";

export function TeacherNotesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { data, isLoading, refetch, isRefetching } = useTeacherNotesOverview();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLET" | "EN_SAISIE" | "BROUILLON">("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const initialClassName =
    typeof route.params?.initialClassName === "string" ? route.params.initialClassName : null;

  useEffect(() => {
    if (initialClassName) {
      setClassFilter(initialClassName);
    }
  }, [initialClassName]);

  const classOptions = useMemo(() => {
    return Array.from(new Set((data?.items ?? []).map((item) => item.className)));
  }, [data?.items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (data?.items ?? []).filter((item) => {
      if (
        query &&
        ![item.title, item.className, item.subjectName].join(" ").toLowerCase().includes(query)
      ) {
        return false;
      }

      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }

      if (classFilter !== "ALL" && item.className !== classFilter) {
        return false;
      }

      return true;
    });
  }, [classFilter, data?.items, search, statusFilter]);

  return (
    <AppScreen
      title="Notes"
      subtitle={
        data?.academicYear?.name
          ? `Evaluations et saisie sur ${data.academicYear.name}`
          : "Saisie et suivi des evaluations"
      }
      refreshing={isRefetching}
      onRefresh={refetch}
      rightSlot={
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.navigate("TeacherEvaluationCreate")}
        >
          <Text style={styles.headerButtonText}>Nouvelle</Text>
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
                id: "pending",
                label: "A completer",
                value: String(data.stats.pendingEvaluations),
                tone: "warning",
              }}
            />
            <KpiCard
              item={{
                id: "completed",
                label: "Completes",
                value: String(data.stats.completedEvaluations),
                tone: "success",
              }}
            />
          </View>

          <View style={styles.metricsRow}>
            <KpiCard
              item={{
                id: "evals",
                label: "Evaluations",
                value: String(data.stats.totalEvaluations),
                tone: "primary",
              }}
            />
            <KpiCard
              item={{
                id: "courses",
                label: "Cours",
                value: String(data.stats.totalCourses),
                tone: "info",
              }}
            />
          </View>

          <Card>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une evaluation"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
            />

            <View style={styles.filterRow}>
              {[
                { id: "ALL", label: "Tous" },
                { id: "EN_SAISIE", label: "En saisie" },
                { id: "COMPLET", label: "Complets" },
                { id: "BROUILLON", label: "Brouillons" },
              ].map((item) => {
                const active = item.id === statusFilter;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setStatusFilter(item.id as typeof statusFilter)}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setClassFilter("ALL")}
                style={[styles.filterChip, classFilter === "ALL" ? styles.filterChipActive : null]}
              >
                <Text
                  style={[
                    styles.filterText,
                    classFilter === "ALL" ? styles.filterTextActive : null,
                  ]}
                >
                  Toutes les classes
                </Text>
              </Pressable>
              {classOptions.map((item) => {
                const active = item === classFilter;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setClassFilter(item)}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {filteredItems.length ? (
            <View style={styles.list}>
              {filteredItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate("TeacherGradeEntry", { evaluationId: item.id })}
                >
                  <Card>
                    <View style={styles.header}>
                      <View style={styles.headerText}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.subtitle}>
                          {item.className} | {item.subjectName}
                        </Text>
                      </View>
                      <View style={styles.headerAside}>
                        <View
                          style={[
                            styles.statusBadge,
                            item.status === "COMPLET"
                              ? styles.statusComplete
                              : item.status === "BROUILLON"
                                ? styles.statusDraft
                                : styles.statusProgress,
                          ]}
                        >
                          <Text style={styles.statusText}>{item.status.replace("_", " ")}</Text>
                        </View>
                        <Pressable
                          onPress={() => navigation.navigate("TeacherEvaluationCreate", { evaluationId: item.id })}
                          style={styles.manageButton}
                        >
                          <Text style={styles.manageButtonText}>Editer</Text>
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.meta}>
                      {item.enteredNotes}/{item.expectedNotes} notes | max {item.noteMax}
                    </Text>

                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${item.completionRate}%` }]} />
                    </View>
                    <Text style={styles.progressLabel}>{item.completionRate}% complete</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Aucune evaluation"
              message="Aucune evaluation ne correspond aux filtres actuels."
            />
          )}
        </>
      ) : (
        <EmptyState
          title="Vue notes indisponible"
          message="Impossible de charger les evaluations de ce compte pour le moment."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "center",
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    textTransform: "uppercase",
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
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
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
  headerAside: {
    alignItems: "flex-end",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  meta: {
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
  progressLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textMuted,
  },
  statusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusComplete: {
    backgroundColor: "#dcfce7",
  },
  statusProgress: {
    backgroundColor: "#dbeafe",
  },
  statusDraft: {
    backgroundColor: "#fef3c7",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.text,
  },
  manageButton: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  manageButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.text,
    textTransform: "uppercase",
  },
});
