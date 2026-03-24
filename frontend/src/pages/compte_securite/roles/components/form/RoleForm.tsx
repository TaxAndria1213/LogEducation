import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import RoleService from "../../../../../services/role.service";
import { mergeScopePermissions } from "../../../../../utils/permissionScope";
import { useRoleCreateStore } from "../../store/RoleCreateStore";

type FeatureItem = {
  code: string;
  label: string;
  description: string;
};

type FeatureGroup = {
  key: string;
  title: string;
  description: string;
  items: FeatureItem[];
};

type RoleTemplate = {
  key: string;
  label: string;
  suggestedName: string;
  description: string;
  permissions: string[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "administration",
    title: "Administration",
    description: "Pilotage global et selection d'etablissement.",
    items: [
      {
        code: "ADM.*",
        label: "Administration globale",
        description: "Acces aux outils d'administration et aux selections globales.",
      },
    ],
  },
  {
    key: "etablissement",
    title: "Etablissement",
    description: "Configuration de la structure et du calendrier scolaire.",
    items: [
      { code: "ET.*", label: "Tous les modules etablissement", description: "Sites, salles, annees scolaires et periodes." },
    ],
  },
  {
    key: "compte_securite",
    title: "Comptes & securite",
    description: "Utilisateurs, roles, profils, permissions et affectations.",
    items: [
      { code: "CS.UTILISATEURS.*", label: "Utilisateurs", description: "Gestion des comptes utilisateurs." },
      { code: "CS.ROLES.*", label: "Roles", description: "Gestion des roles et des liens de creation." },
      { code: "CS.PROFILS.*", label: "Profils", description: "Consultation et gestion des profils." },
      { code: "CS.PERMISSIONS.*", label: "Permissions", description: "Catalogue fonctionnel des permissions." },
      { code: "CS.AFFECTATIONS.*", label: "Affectations", description: "Affectation des roles et ajustements de scope." },
    ],
  },
  {
    key: "scolarite",
    title: "Scolarite",
    description: "Parcours eleve, classes et inscriptions.",
    items: [
      { code: "SC.INSCRIPTIONS.*", label: "Inscriptions", description: "Nouvelles inscriptions et reinscriptions." },
      { code: "SC.CLASSES.*", label: "Classes", description: "Organisation des classes." },
      { code: "SC.NIVEAUX.*", label: "Niveaux", description: "Parametrage des niveaux scolaires." },
      { code: "SC.PARENTSTUTEURS.*", label: "Parents / tuteurs", description: "Responsables des eleves." },
      { code: "SC.IDENTIFIANTS.*", label: "Identifiants eleves", description: "Documents et identifiants eleves." },
      { code: "SC.ELEVES.*", label: "Eleves", description: "Fiches eleves et suivi." },
    ],
  },
  {
    key: "personnel",
    title: "Personnel",
    description: "Equipes et organisation interne.",
    items: [
      { code: "PE.PERSONNELS.*", label: "Personnels", description: "Fiches personnel et comptes rattaches." },
      { code: "PE.ENSEIGNANTS.*", label: "Enseignants", description: "Profils enseignants." },
      { code: "PE.DEPARTEMENTS.*", label: "Departements", description: "Organisation pedagogique par departement." },
    ],
  },
  {
    key: "pedagogie",
    title: "Pedagogie",
    description: "Organisation des enseignements et evaluations.",
    items: [
      { code: "PD.MATIERES.*", label: "Matieres", description: "Catalogue et pilotage des matieres." },
      { code: "PD.PROGRAMMES.*", label: "Programmes", description: "Programmes par niveau et annee." },
      { code: "PD.COURS.*", label: "Cours", description: "Affectation des cours." },
      { code: "PD.EVALUATIONS.*", label: "Evaluations", description: "Controle continu et examens." },
      { code: "PD.NOTES.*", label: "Notes", description: "Saisie et suivi des notes." },
      { code: "PD.BULLETINS.*", label: "Bulletins", description: "Generation et publication des bulletins." },
      { code: "PD.REGLESNOTES.*", label: "Regles de notes", description: "Parametrage de la notation." },
    ],
  },
  {
    key: "emploi_du_temps",
    title: "Emploi du temps & calendrier",
    description: "Planning des cours et evenements.",
    items: [
      { code: "EDT.EMPLOIDUTEMPS.*", label: "Emploi du temps", description: "Construction et consultation des EDT." },
      { code: "EDT.EVENEMENTS.*", label: "Evenements", description: "Calendrier et evenements." },
    ],
  },
  {
    key: "presences",
    title: "Presences",
    description: "Appel, retards, justificatifs et suivi du personnel.",
    items: [
      { code: "PR.SESSIONSAPPEL.*", label: "Sessions d'appel", description: "Ouverture et suivi des appels." },
      { code: "PR.PRESENCESELEVES.*", label: "Presences eleves", description: "Feuilles d'appel et statuts des eleves." },
      { code: "PR.JUSTIFICATIFS.*", label: "Justificatifs", description: "Traitement des justificatifs d'absence." },
      { code: "PR.PRESENCESPERSONNEL.*", label: "Presences personnel", description: "Suivi quotidien du personnel." },
    ],
  },
  {
    key: "discipline",
    title: "Discipline",
    description: "Incidents, sanctions et recompenses eleves.",
    items: [
      { code: "DI.INCIDENTS.*", label: "Incidents", description: "Signalement et suivi des incidents eleves." },
      { code: "DI.SANCTIONS.*", label: "Sanctions", description: "Actions disciplinaires et decisions prises." },
      { code: "DI.RECOMPENSES.*", label: "Recompenses", description: "Encouragements et valorisation du comportement." },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    description: "Tarifs, facturation et suivi financier.",
    items: [
      { code: "FIN.CATALOGUEFRAIS.*", label: "Catalogue de frais", description: "Tarifs et frais reutilisables de l'etablissement." },
      { code: "FIN.REMISES.*", label: "Remises", description: "Reductions en pourcentage ou montant fixe." },
      { code: "FIN.FACTURES.*", label: "Factures", description: "Emission, detail et suivi des factures eleves." },
      { code: "FIN.PAIEMENTS.*", label: "Paiements", description: "Encaissements, references et suivi des reglements." },
      { code: "FIN.PLANSPAIEMENT.*", label: "Plans de paiement", description: "Echeanciers et tranches de paiement par eleve." },
    ],
  },
];

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "ADMIN",
    label: "Administrateur",
    suggestedName: "Administrateur",
    description: "Acces total aux modules et a l'administration globale.",
    permissions: ["ADM.*", "ET.*", "CS.*", "SC.*", "PE.*", "PD.*", "EDT.*", "PR.*", "DI.*", "FIN.*"],
  },
  {
    key: "DIRECTION",
    label: "Direction",
    suggestedName: "Direction",
    description: "Pilotage transverse de l'etablissement sans administration pure.",
    permissions: ["ET.*", "SC.*", "PE.*", "PD.*", "EDT.*", "PR.*", "DI.*", "FIN.*"],
  },
  {
    key: "SECRETARIAT",
    label: "Secretariat",
    suggestedName: "Secretariat",
    description: "Orientation administrative, eleves et suivi quotidien.",
    permissions: ["ET.*", "SC.*", "PR.*", "DI.*"],
  },
  {
    key: "ENSEIGNANT",
    label: "Enseignant",
    suggestedName: "Enseignant",
    description: "Pedagogie, emploi du temps et presences.",
    permissions: ["PD.*", "EDT.*", "PR.*"],
  },
  {
    key: "COMPTABLE",
    label: "Comptable",
    suggestedName: "Comptable",
    description: "Acces restreint aux donnees utiles pour le suivi administratif et financier.",
    permissions: ["ET.*", "SC.*", "FIN.*"],
  },
  {
    key: "SURVEILLANT",
    label: "Surveillant",
    suggestedName: "Surveillant",
    description: "Controle terrain, appels et classes utiles au suivi.",
    permissions: ["PR.*", "EDT.*", "SC.CLASSES.*", "SC.ELEVES.*", "DI.*"],
  },
  {
    key: "PARENT",
    label: "Parent",
    suggestedName: "Parent",
    description: "Role minimal pour les comptes famille et parcours dedies.",
    permissions: [],
  },
  {
    key: "ELEVE",
    label: "Eleve",
    suggestedName: "Eleve",
    description: "Role minimal pour l'acces des eleves.",
    permissions: [],
  },
];

function togglePermission(current: string[], code: string) {
  return current.includes(code)
    ? current.filter((item) => item !== code)
    : [...current, code];
}

function RoleForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new RoleService(), []);
  const loading = useRoleCreateStore((state) => state.loading);
  const templateInitialData = useRoleCreateStore((state) => state.initialData);
  const setInitialData = useRoleCreateStore((state) => state.setInitialData);

  const [roleName, setRoleName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id });
    }
  }, [etablissement_id, setInitialData]);

  const activeTemplate = useMemo(
    () => ROLE_TEMPLATES.find((template) => template.key === templateKey) ?? null,
    [templateKey],
  );

  const selectedCount = selectedPermissions.length;

  const onTemplateChange = (nextTemplateKey: string) => {
    const nextTemplate =
      ROLE_TEMPLATES.find((template) => template.key === nextTemplateKey) ?? null;
    const previousSuggestedName = activeTemplate?.suggestedName ?? "";

    setTemplateKey(nextTemplateKey);
    setSelectedPermissions(nextTemplate?.permissions ?? []);

    if (!roleName.trim() || roleName.trim() === previousSuggestedName) {
      setRoleName(nextTemplate?.suggestedName ?? "");
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = roleName.trim();
    const etablissementId = etablissement_id ?? templateInitialData?.etablissement_id ?? null;

    if (!etablissementId) {
      info("Aucun etablissement actif n'est disponible pour creer le role.", "error");
      return;
    }

    if (!normalizedName) {
      info("Le nom du role est obligatoire.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const scope = {
        role_template: templateKey || null,
        role_template_label: activeTemplate?.label ?? null,
        ...mergeScopePermissions(null, selectedPermissions),
      };

      await service.create({
        nom: normalizedName,
        etablissement_id: etablissementId,
        scope_json: scope,
      });

      info("Role cree avec succes !", "success");
      setRoleName("");
      setTemplateKey("");
      setSelectedPermissions([]);
    } catch (error) {
      console.error("Erreur creation role", error);
      info("Le role n'a pas pu etre cree.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">Creation d'un role</h2>
              <p className="text-sm leading-6 text-slate-600">
                Donne un nom libre au role, choisis si besoin un modele predefini,
                puis ajuste les fonctionnalites a activer. Le role restera
                personnalise meme s'il part d'une base standard.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Nom du role</span>
                <input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Ex: Responsable pedagogique"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Modele de fonctionnalites</span>
                <select
                  value={templateKey}
                  onChange={(event) => onTemplateChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Aucun modele predefini</option>
                  {ROLE_TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {selectedCount} fonctionnalite{selectedCount > 1 ? "s" : ""}
                </span>
                <span className="text-sm text-slate-600">
                  {activeTemplate
                    ? activeTemplate.description
                    : "Tu peux partir de zero et composer ton role sur mesure."}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {FEATURE_GROUPS.map((group) => (
              <section
                key={group.key}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">{group.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{group.description}</p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => {
                    const checked = selectedPermissions.includes(item.code);
                    return (
                      <label
                        key={item.code}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                          checked
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedPermissions((current) =>
                              togglePermission(current, item.code),
                            )
                          }
                          className="mt-1 h-4 w-4 accent-slate-900"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className={`block text-xs ${checked ? "text-slate-200" : "text-slate-600"}`}>
                            {item.description}
                          </span>
                          <span className={`block text-[11px] uppercase tracking-wide ${checked ? "text-slate-300" : "text-slate-500"}`}>
                            {item.code}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>Enregistrer le role</span>
              {submitting ? <Spin inline /> : null}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default RoleForm;
