import React, { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import type { Utilisateur, UtilisateurRole } from "../types/models";
import type { componentId } from "../types/types";
import { profileEtablissementComponents } from "../pages/etablissement/profileEtablissement/components/CI.profileEtablissement";
import { adminComponents } from "../pages/admin/components/CI.admin";
import { siteComponents } from "../pages/etablissement/sites/components/CI.sites";
import { utilisateurComponents } from "../pages/compte_securite/utilisateurs/components/CI.utilisateur";
import { salleComponents } from "../pages/etablissement/salles/components/CI.salle";
import { anneeScolaireComponents } from "../pages/etablissement/anneeScolaire/components/CI.AnneeScolaire";
import { periodeComponents } from "../pages/etablissement/periodes/components/CI.periode";
import { roleComponents } from "../pages/compte_securite/roles/components/CI.role";
import { inscriptionComponents } from "../pages/scolarite/inscriptions/components/CI.inscription";
import { classeComponents } from "../pages/scolarite/classes/components/CI.classe";
import { niveauComponents } from "../pages/scolarite/niveaux/components/CI.niveau";
import { parentTuteurComponents } from "../pages/scolarite/parents_tuteurs/components/CI.ParentTuteur";
import { identifiantEleveComponents } from "../pages/scolarite/identifiant_eleve/components/CI.IdEleve";
import { eleveComponents } from "../pages/scolarite/eleve/components/CI.eleve";
import { personnelComponents } from "../pages/personnel/personnels/components/CI.personnel";
import { enseignantComponents } from "../pages/personnel/enseignants/components/CI.enseignants";
import { departementComponents } from "../pages/personnel/departements/components/CI.departement";

export type ComponentIdentifierType = {
  id: componentId;
  name: string;
  component: (
    id: string,
    access: boolean,
    optionsStyle?: React.CSSProperties,
    onClick?: () => void,
  ) => React.ReactElement;
  adminOnly?: boolean;
};

// liste des composants
const components: ComponentIdentifierType[] = [
  ...adminComponents,
  ...profileEtablissementComponents,
  ...siteComponents,
  ...utilisateurComponents,
  ...salleComponents,
  ...anneeScolaireComponents,
  ...periodeComponents,
  ...roleComponents,
  ...inscriptionComponents,
  ...classeComponents,
  ...niveauComponents,
  ...parentTuteurComponents,
  ...identifiantEleveComponents,
  ...eleveComponents,
  ...personnelComponents,
  ...enseignantComponents,
  ...departementComponents,
];

/**
 * Index O(1) : évite un `.find()` à chaque render
 * (créé une seule fois au chargement du module)
 */
const componentsById: Partial<Record<componentId, ComponentIdentifierType>> =
  Object.fromEntries(components.map((c) => [c.id, c])) as Partial<
    Record<componentId, ComponentIdentifierType>
  >;

// récupération du composant par son id
export function getComponentById(id: componentId) {
  const DynamicComponent: React.FC<{
    optionsStyle?: React.CSSProperties;
    onClick?: () => void;
  }> = (props) => {
    const { roles, user } = useAuth();

    const access = useMemo(() => {
      if (!user || !roles || !id) return false;
      return verifyAccess(user, roles, id);
    }, [user, roles]);

    const item = componentsById[id];
    if (!item) return null;

    // ✅ applique adminOnly ici
    if (!access) return null;

    return item.component(id, access, props.optionsStyle, props.onClick);
  };

  DynamicComponent.displayName = `DynamicComponent(${String(id)})`;
  return React.memo(DynamicComponent);
}

// vérification de l'accès de l'utilisateur (pure function)
function verifyAccess(
  user: Utilisateur,
  roles: UtilisateurRole[],
  id: componentId,
): boolean {
  // si un jour tu ajoutes d'autres règles, tu les mets ici
  const isAdmin = roles.some((role) => role.role?.nom === "ADMIN")
    ? true
    : false;
  const isDirection = roles.some((role) => role.role?.nom === "DIRECTION")
    ? true
    : false;

  if (isAdmin && componentsById[id]?.adminOnly) return true;
  else if (isDirection) {
    if (componentsById[id]?.adminOnly) return false;
    else return true;
  }

  // garde ton log si tu veux
  // console.log("🚀 ~ verifyAccess ~ isAdmin:", isAdmin);

  return isAdmin;
}

export {verifyAccess as hasAccess};
