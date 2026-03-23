import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { QuickActionGrid } from "@/components/QuickActionGrid";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { SectionTitle } from "@/components/SectionTitle";
import { theme } from "@/constants/theme";
import { useHomeBundle } from "@/hooks/useRoleFeeds";
import { useAuth } from "@/providers/AuthProvider";

export function HomeScreen() {
  const navigation = useNavigation();
  const { data, isLoading, refetch, isRefetching } = useHomeBundle();
  const { availableRoles, activeRole, switchRole } = useAuth();

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
            onPress={(action) =>
              navigation.navigate(action.target as never)
            }
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
  list: {
    gap: theme.spacing.sm,
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
});
