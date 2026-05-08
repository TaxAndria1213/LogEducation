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
import { initialisationEtablissementComponents } from "../pages/etablissement/initialisation/components/CI.initialisationEtablissement";
import { periodeComponents } from "../pages/etablissement/periodes/components/CI.periode";
import { referentielComponents } from "../pages/etablissement/referentiels/components/CI.referentiel";
import { roleComponents } from "../pages/compte_securite/roles/components/CI.role";
import { profileComponents } from "../pages/compte_securite/profils/components/CI.profile";
import { permissionComponents } from "../pages/compte_securite/permissions/components/CI.permission";
import { affectationComponents } from "../pages/compte_securite/affectations/components/CI.affectation";
import { inscriptionComponents } from "../pages/scolarite/inscriptions/components/CI.inscription";
import { classeComponents } from "../pages/scolarite/classes/components/CI.classe";
import { niveauComponents } from "../pages/scolarite/niveaux/components/CI.niveau";
import { parentTuteurComponents } from "../pages/scolarite/parents_tuteurs/components/CI.ParentTuteur";
import { identifiantEleveComponents } from "../pages/scolarite/identifiant_eleve/components/CI.IdEleve";
import { eleveComponents } from "../pages/scolarite/eleve/components/CI.eleve";
import { personnelComponents } from "../pages/personnel/personnels/components/CI.personnel";
import { enseignantComponents } from "../pages/personnel/enseignants/components/CI.enseignants";
import { departementComponents } from "../pages/personnel/departements/components/CI.departement";
import { matiereComponents } from "../pages/pedagogie/matieres/components/CI.matiere";
import { programmeComponents } from "../pages/pedagogie/programmes/components/CI.programme";
import { coursComponents } from "../pages/pedagogie/cours/components/CI.cours";
import { evaluationComponents } from "../pages/pedagogie/evaluations/components/CI.evaluation";
import { noteComponents } from "../pages/pedagogie/notes/components/CI.note";
import { bulletinComponents } from "../pages/pedagogie/bulletins/components/CI.bulletin";
import { regleNoteComponents } from "../pages/pedagogie/regles_notes/components/CI.regleNote";
import { typeEvaluationRefComponents } from "../pages/pedagogie/types_evaluations/components/CI.typeEvaluationRef";
import { reportCardTemplateComponents } from "../pages/pedagogie/modeles_bulletins/components/CI.reportCardTemplate";
import { emploiDuTempsComponents } from "../pages/emploi_du_temps/components/CI.emploiDuTemps";
import { evenementCalendrierComponents } from "../pages/emploi_du_temps/components/CI.evenement";
import { sessionAppelComponents } from "../pages/presences/sessions_appel/components/CI.sessionAppel";
import { presenceEleveComponents } from "../pages/presences/presences_eleves/components/CI.presenceEleve";
import { justificatifAbsenceComponents } from "../pages/presences/justificatifs/components/CI.justificatif";
import { presencePersonnelComponents } from "../pages/presences/presences_personnel/components/CI.presencePersonnel";
import { incidentDisciplinaireComponents } from "../pages/discipline/incidents/components/CI.incident";
import { sanctionDisciplinaireComponents } from "../pages/discipline/sanctions/components/CI.sanction";
import { recompenseComponents } from "../pages/discipline/recompenses/components/CI.recompense";
import { catalogueFraisComponents } from "../pages/finance/catalogue_frais/components/CI.catalogueFrais";
import { remiseComponents } from "../pages/finance/remises/components/CI.remise";
import { factureComponents } from "../pages/finance/factures/components/CI.facture";
import { paiementComponents } from "../pages/finance/paiements/components/CI.paiement";
import { planPaiementComponents } from "../pages/finance/plans_paiement/components/CI.planPaiement";
import { journalFinancierComponents } from "../pages/finance/journal_financier/components/CI.journalFinancier";
import { recouvrementComponents } from "../pages/finance/recouvrement/components/CI.recouvrement";
import { transportComponents } from "../pages/transport_cantine/transport/components/CI.transport";
import { cantineComponents } from "../pages/transport_cantine/cantine/components/CI.cantine";
import { ressourceBibliothequeComponents } from "../pages/bibliotheque/ressources/components/CI.ressourceBibliotheque";
import { empruntBibliothequeComponents } from "../pages/bibliotheque/emprunts/components/CI.empruntBibliotheque";
import { documentsInscriptionComponents } from "../pages/documents/types_inscription/components/CI.documents";
import {
  extractPermissionCodes,
  permissionMatches,
} from "../utils/permissionScope";

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  "ADMIN",
  "ADMINISTRATEUR",
  "ADMINISTRATOR",
  "SUPER ADMIN",
  "SUPERADMIN",
]);

function parseScopeObject(rawScope: unknown): Record<string, unknown> | null {
  if (!rawScope) return null;

  if (typeof rawScope === "string") {
    try {
      const parsed = JSON.parse(rawScope);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawScope === "object" && !Array.isArray(rawScope)
    ? (rawScope as Record<string, unknown>)
    : null;
}

function normalizeRoleName(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function resolveAssignmentRoleNames(assignment: UtilisateurRole): string[] {
  const scope = parseScopeObject(assignment.role?.scope_json ?? assignment.scope_json);
  const candidateNames = [
    assignment.role?.nom,
    typeof scope?.role_template === "string" ? scope.role_template : null,
    typeof scope?.role_template_label === "string" ? scope.role_template_label : null,
  ];

  return Array.from(
    new Set(candidateNames.map((value) => normalizeRoleName(value)).filter(Boolean)),
  );
}

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
  ...initialisationEtablissementComponents,
  ...periodeComponents,
  ...referentielComponents,
  ...roleComponents,
  ...profileComponents,
  ...permissionComponents,
  ...affectationComponents,
  ...inscriptionComponents,
  ...classeComponents,
  ...niveauComponents,
  ...parentTuteurComponents,
  ...identifiantEleveComponents,
  ...eleveComponents,
  ...personnelComponents,
  ...enseignantComponents,
  ...departementComponents,
  ...matiereComponents,
  ...programmeComponents,
  ...coursComponents,
  ...evaluationComponents,
  ...noteComponents,
  ...bulletinComponents,
  ...regleNoteComponents,
  ...typeEvaluationRefComponents,
  ...reportCardTemplateComponents,
  ...emploiDuTempsComponents,
  ...evenementCalendrierComponents,
  ...sessionAppelComponents,
  ...presenceEleveComponents,
  ...justificatifAbsenceComponents,
  ...presencePersonnelComponents,
  ...incidentDisciplinaireComponents,
  ...sanctionDisciplinaireComponents,
  ...recompenseComponents,
  ...catalogueFraisComponents,
  ...remiseComponents,
  ...factureComponents,
  ...paiementComponents,
  ...planPaiementComponents,
  ...journalFinancierComponents,
  ...recouvrementComponents,
  ...transportComponents,
  ...cantineComponents,
  ...ressourceBibliothequeComponents,
  ...empruntBibliothequeComponents,
  ...documentsInscriptionComponents,
];

/**
 * Index O(1) : évite un `.find()` à chaque render
 * (créé une seule fois au chargement du module)
 */
const componentsById: Partial<Record<componentId, ComponentIdentifierType>> =
  Object.fromEntries(components.map((c) => [c.id, c])) as Partial<
    Record<componentId, ComponentIdentifierType>
  >;

export type ComponentPermissionCatalogItem = {
  code: componentId;
  description: string;
  adminOnly?: boolean;
};

export const componentPermissionCatalog: ComponentPermissionCatalogItem[] =
  Array.from(
    new Map(
      components.map((item) => [
        item.id,
        {
          code: item.id,
          description: item.name,
          adminOnly: Boolean(item.adminOnly),
        },
      ]),
    ).values(),
  );

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

    // ? applique adminOnly ici
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
  const isAdmin = roles.some((role) =>
    resolveAssignmentRoleNames(role).some((roleName) => SYSTEM_ADMIN_ROLE_NAMES.has(roleName)),
  );
  const isDirection = roles.some((role) =>
    resolveAssignmentRoleNames(role).includes("DIRECTION"),
  );
  const item = componentsById[id];
  const grantedCodes = getGrantedPermissionCodes(roles);

  if (item?.adminOnly) {
    return isAdmin;
  }

  if (isAdmin) return true;

  const deniedCodes = getDeniedPermissionCodes(roles);
  if (deniedCodes.some((code) => permissionMatches(code, id))) {
    return false;
  }

  if (grantedCodes.some((code) => permissionMatches(code, id))) {
    return true;
  }

  // Transition douce: tant qu'un utilisateur direction n'a pas encore
  // de permissions explicites rattachees a ses roles, on garde l'ancien comportement.
  if (isDirection && grantedCodes.length === 0) {
    return true;
  }

  return false;
}

export function getGrantedPermissionCodes(roles: UtilisateurRole[]): string[] {
  return Array.from(
    new Set(
      roles.flatMap((assignment) => [
        ...extractPermissionCodes(assignment.role?.scope_json, "permissions"),
        ...extractPermissionCodes(assignment.scope_json, "permissions"),
        ...extractPermissionCodes(assignment.scope_json, "allowed_permissions"),
      ]),
    ),
  );
}

export function getDeniedPermissionCodes(roles: UtilisateurRole[]): string[] {
  return Array.from(
    new Set(
      roles.flatMap((assignment) =>
        extractPermissionCodes(assignment.scope_json, "denied_permissions"),
      ),
    ),
  );
}

export function getScopesForPermission(
  roles: UtilisateurRole[],
  requestedCode: componentId | string,
) {
  return roles
    .filter((assignment) =>
      getGrantedPermissionCodes([assignment]).some((code) =>
        permissionMatches(code, requestedCode),
      ) &&
      !getDeniedPermissionCodes([assignment]).some((code) =>
        permissionMatches(code, requestedCode),
      ),
    )
    .map((assignment) => assignment.scope_json)
    .filter((scope) => scope != null);
}

export { verifyAccess as hasAccess };



