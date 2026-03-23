import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { theme } from "@/constants/theme";
import { useAgendaBundle } from "@/hooks/useRoleFeeds";

export function AgendaScreen() {
  const { data, isLoading, refetch, isRefetching } = useAgendaBundle();

  return (
    <AppScreen
      title={data?.title || "Agenda"}
      subtitle={data?.subtitle || "Planning et reperes temporels"}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} />
      ) : data?.items.length ? (
        <View style={styles.list}>
          {data.items.map((item) => (
            <Card key={item.id}>
              <Text style={styles.title}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Agenda vide"
          message="Aucun element d'agenda n'est disponible pour le role actif."
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
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
