import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { theme } from "@/constants/theme";
import { useTeacherProfile } from "@/hooks/useTeacherMobile";
import { useAuth } from "@/providers/AuthProvider";

export function ProfileScreen() {
  const { session, availableRoles, activeRole, switchRole, signOut } = useAuth();
  const teacherProfile = useTeacherProfile();

  const fullName = [
    session?.user.profil?.prenom?.trim(),
    session?.user.profil?.nom?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const isTeacher = activeRole === "ENSEIGNANT";
  const profile = teacherProfile.data;

  return (
    <AppScreen title="Profil" subtitle="Compte, role actif et securite">
      {isTeacher ? (
        teacherProfile.isLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : profile ? (
          <>
            <Card>
              <Text style={styles.name}>{profile.fullName}</Text>
              <Text style={styles.meta}>{profile.email || "Email non renseigne"}</Text>
              <Text style={styles.meta}>{profile.telephone || "Telephone non renseigne"}</Text>
              <Text style={styles.meta}>
                {profile.specialty
                  ? `${profile.specialty} | ${profile.academicYearName}`
                  : profile.academicYearName}
              </Text>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Affectations</Text>
              <Text style={styles.meta}>
                Matieres: {profile.subjects.length ? profile.subjects.join(", ") : "Aucune"}
              </Text>
              <Text style={styles.meta}>
                Classes: {profile.classes.length ? profile.classes.join(", ") : "Aucune"}
              </Text>
              {profile.address ? <Text style={styles.meta}>Adresse: {profile.address}</Text> : null}
            </Card>
          </>
        ) : (
          <EmptyState
            title="Profil enseignant indisponible"
            message="Impossible de charger les informations metier de ce compte enseignant."
          />
        )
      ) : (
        <Card>
          <Text style={styles.name}>{fullName || "Utilisateur"}</Text>
          <Text style={styles.meta}>{session?.user.email || "Email non renseigne"}</Text>
          <Text style={styles.meta}>
            {session?.user.etablissement?.nom || "Etablissement non renseigne"}
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.sectionTitle}>Role actif</Text>
        <RoleSwitcher
          roles={availableRoles}
          activeRole={activeRole}
          onChange={switchRole}
        />
      </Card>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonLabel}>Se deconnecter</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
  },
  meta: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  button: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.danger,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
