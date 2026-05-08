import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { QuickActionGrid } from "@/components/QuickActionGrid";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { SectionTitle } from "@/components/SectionTitle";
import { theme } from "@/constants/theme";
import { useHomeBundle } from "@/hooks/useRoleFeeds";
import { useTeacherDashboard } from "@/hooks/useTeacherMobile";
import { useAuth } from "@/providers/AuthProvider";

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(value));
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { availableRoles, activeRole, switchRole } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useHomeBundle(activeRole !== "ENSEIGNANT");
  const teacherQuery = useTeacherDashboard();

  const teacherData = teacherQuery.data;

  if (activeRole === "ENSEIGNANT") {
    return (
      <AppScreen
        title="Accueil"
        subtitle="Vue quotidienne enseignant"
        refreshing={teacherQuery.isRefetching}
        onRefresh={() => {
          void teacherQuery.refetch();
        }}
      >
        <RoleSwitcher
          roles={availableRoles}
          activeRole={activeRole}
          onChange={switchRole}
        />

        {teacherQuery.isLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : teacherData ? (
          <>
            <Card>
              <Text style={styles.heroKicker}>{teacherData.academicYear.name}</Text>
              <Text style={styles.heroTitle}>
                Bonjour {teacherData.teacher.firstName || teacherData.teacher.fullName}
              </Text>
              <Text style={styles.heroSubtitle}>{formatDateLabel(teacherData.todayDate)}</Text>
            </Card>

            <SectionTitle
              title="Aujourdhui"
              subtitle="Le strict utile pour la journee."
            />
            <View style={styles.metricsRow}>
              <KpiCard
                item={{
                  id: "classes",
                  label: "Classes",
                  value: String(teacherData.stats.classCount),
                  tone: "primary",
                }}
              />
              <KpiCard
                item={{
                  id: "courses",
                  label: "Cours du jour",
                  value: String(teacherData.stats.coursesToday),
                  tone: "info",
                }}
              />
            </View>

            <View style={styles.metricsRow}>
              <KpiCard
                item={{
                  id: "grades",
                  label: "Notes a saisir",
                  value: String(teacherData.stats.pendingGradeSheets),
                  tone: "warning",
                }}
              />
              <KpiCard
                item={{
                  id: "remarks",
                  label: "Appreciations",
                  value: String(teacherData.stats.pendingRemarks),
                  tone: "success",
                }}
              />
            </View>

            <SectionTitle
              title="Actions rapides"
              subtitle="Les raccourcis enseignant les plus utiles."
            />
            <View style={styles.teacherActionsRow}>
              <Pressable
                style={[styles.teacherAction, styles.teacherActionPrimary]}
                onPress={() => navigation.navigate("Classes")}
              >
                <Text style={styles.teacherActionLabel}>Mes classes</Text>
                <Text style={styles.teacherActionText}>Eleves, suivi et absences</Text>
              </Pressable>
              <Pressable
                style={[styles.teacherAction, styles.teacherActionSecondary]}
                onPress={() => navigation.getParent()?.navigate("PresenceFlow")}
              >
                <Text style={styles.teacherActionLabelDark}>Faire l'appel</Text>
                <Text style={styles.teacherActionTextDark}>Ouvrir la feuille du jour</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.teacherAction, styles.teacherActionMuted]}
              onPress={() => navigation.navigate("Notes")}
            >
              <Text style={styles.teacherActionLabelDark}>Suivre les notes</Text>
              <Text style={styles.teacherActionTextDark}>
                Voir les evaluations a completer et l'avancement de saisie.
              </Text>
            </Pressable>

            <SectionTitle
              title="Cours du jour"
              subtitle="Planning du jour, filtre automatiquement sur tes affectations."
            />
            {teacherData.todayCourses.length ? (
              <View style={styles.list}>
                {teacherData.todayCourses.map((course) => (
                  <Card key={course.id}>
                    <View style={styles.teacherCourseHeader}>
                      <View style={styles.headerText}>
                        <Text style={styles.itemTitle}>{course.subjectName}</Text>
                        <Text style={styles.itemSubtitle}>
                          {course.className} | {course.levelName}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.courseStatusBadge,
                          course.status === "EN_COURS"
                            ? styles.courseStatusCurrent
                            : course.status === "A_VENIR"
                              ? styles.courseStatusUpcoming
                              : styles.courseStatusDone,
                        ]}
                      >
                        <Text style={styles.courseStatusText}>{course.status.replace("_", " ")}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemMeta}>
                      {course.slotLabel} | {course.roomName}
                    </Text>
                    <Pressable
                      style={styles.inlinePrimaryButton}
                      onPress={() => navigation.getParent()?.navigate("PresenceFlow")}
                    >
                      <Text style={styles.inlinePrimaryButtonText}>Faire l'appel</Text>
                    </Pressable>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                title="Aucun cours aujourd'hui"
                message="Aucun creneau enseignant n'est actif aujourd'hui pour l'annee scolaire courante."
              />
            )}

            <SectionTitle
              title="Prochaines evaluations"
              subtitle="Les evaluations qui arrivent bientot."
            />
            {teacherData.upcomingEvaluations.length ? (
              <View style={styles.list}>
                {teacherData.upcomingEvaluations.map((item) => (
                  <Card key={item.id}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSubtitle}>
                      {item.className} | {item.subjectName}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(item.date))}{" "}
                      | {item.status}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                title="Aucune evaluation proche"
                message="Aucune evaluation a venir n'est encore programmee pour ce compte."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="Dashboard enseignant indisponible"
            message="Impossible de charger les donnees enseignant pour le moment."
          />
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="Accueil"
      subtitle="Une experience mobile adaptee au role actif."
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <RoleSwitcher
        roles={availableRoles}
        activeRole={activeRole}
        onChange={switchRole}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : data ? (
        <>
          <Card>
            <Text style={styles.heroTitle}>{data.heading}</Text>
            <Text style={styles.heroSubtitle}>{data.subtitle}</Text>
          </Card>

          <SectionTitle
            title="Indicateurs"
            subtitle="Les chiffres qui doivent remonter tout de suite."
          />
          <View style={styles.metricsRow}>
            {data.metrics.map((metric) => (
              <KpiCard key={metric.id} item={metric} />
            ))}
          </View>

          <SectionTitle
            title="Actions rapides"
            subtitle="Les raccourcis prioritaires selon ton role."
          />
          <QuickActionGrid
            actions={data.quickActions}
            onPress={(action) => navigation.navigate(action.target as never)}
          />

          <SectionTitle
            title="A suivre"
            subtitle="Les elements recents qui meritent l'attention."
          />
          <View style={styles.list}>
            {data.highlights.map((item) => (
              <Card key={item.id}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                ) : null}
                {item.meta ? <Text style={styles.itemMeta}>{item.meta}</Text> : null}
              </Card>
            ))}
          </View>
        </>
      ) : (
        <EmptyState
          title="Aucune donnee mobile"
          message="Le tableau de bord ne contient pas encore d'informations pour ce role."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroKicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  teacherActionsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  teacherAction: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 6,
  },
  teacherActionPrimary: {
    backgroundColor: theme.colors.primary,
  },
  teacherActionSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  teacherActionMuted: {
    backgroundColor: theme.colors.primarySoft,
  },
  teacherActionLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  teacherActionText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#eaf4ff",
  },
  teacherActionLabelDark: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },
  teacherActionTextDark: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
  list: {
    gap: theme.spacing.sm,
  },
  teacherCourseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  courseStatusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  courseStatusCurrent: {
    backgroundColor: "#dcfce7",
  },
  courseStatusUpcoming: {
    backgroundColor: "#dbeafe",
  },
  courseStatusDone: {
    backgroundColor: "#e2e8f0",
  },
  courseStatusText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.text,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  itemSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  itemMeta: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  inlinePrimaryButton: {
    marginTop: theme.spacing.xs,
    alignSelf: "flex-start",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlinePrimaryButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
});
