import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";
import { useInfo } from "../../../hooks/useInfo";
import EleveService from "../../../services/eleve.service";

type EleveDossierData = {
  eleve: {
    id: string;
    code_eleve?: string | null;
    statut?: string | null;
    date_entree?: string | Date | null;
    prenom?: string | null;
    nom?: string | null;
    date_naissance?: string | Date | null;
    genre?: string | null;
    photo_url?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
  };
  current_year?: {
    id: string;
    nom?: string | null;
    date_debut?: string | Date | null;
    date_fin?: string | Date | null;
  } | null;
  current_inscription?: {
    id: string;
    statut?: string | null;
    type_inscription?: string | null;
    statut_administratif?: string | null;
    statut_financier?: string | null;
    statut_dossier?: string | null;
    date_inscription?: string | Date | null;
    validation_date?: string | Date | null;
    annee?: { id?: string | null; nom?: string | null } | null;
    niveau?: { id?: string | null; nom?: string | null } | null;
    classe?: { id?: string | null; nom?: string | null; site?: string | null } | null;
  } | null;
  inscriptions: Array<{
    id: string;
    statut?: string | null;
    type_inscription?: string | null;
    date_inscription?: string | Date | null;
    validation_date?: string | Date | null;
    annee?: { id?: string | null; nom?: string | null } | null;
    niveau?: { id?: string | null; nom?: string | null } | null;
    classe?: { id?: string | null; nom?: string | null; site?: string | null } | null;
  }>;
  responsables: Array<{
    id: string;
    nom_complet: string;
    relation?: string | null;
    telephone_principal?: string | null;
    telephone_secondaire?: string | null;
    email?: string | null;
    adresse?: string | null;
    profession?: string | null;
    est_principal?: boolean;
    est_responsable_legal?: boolean;
    est_responsable_financier?: boolean;
    est_contact_urgence?: boolean;
  }>;
  identifiants: Array<{
    id: string;
    type?: string | null;
    valeur?: string | null;
  }>;
  finance: {
    total_facture: number;
    total_paye: number;
    reste_a_payer: number;
    nombre_factures: number;
    dernier_paiement?: {
      id: string;
      montant: number;
      date: string | Date;
      numero_recu?: string | null;
      facture_numero?: string | null;
    } | null;
  };
  fichiers: Array<{
    id: string;
    tag?: string | null;
    type_entite?: string | null;
    chemin?: string | null;
    nom_fichier?: string | null;
    type_mime?: string | null;
    televerse_le?: string | Date | null;
  }>;
  medical: {
    authorized: boolean;
    note?: string | null;
    data?: {
      groupe_sanguin?: string | null;
      allergies?: string | null;
      maladies_particulieres?: string | null;
      traitement_medical?: string | null;
      medecin_traitant?: string | null;
      telephone_medecin?: string | null;
      autorisation_prise_en_charge_medicale?: boolean;
      personne_a_contacter_urgence?: string | null;
      telephone_urgence?: string | null;
    } | null;
  };
};

function formatDate(value?: string | Date | null) {
  if (!value) return "Non renseigne";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigne";
  return date.toLocaleDateString("fr-FR");
}

function formatMoney(value?: number | null, devise = "MGA") {
  return `${Number(value ?? 0).toLocaleString("fr-FR")} ${devise}`;
}

function getStatusClasses(status?: string | null) {
  const normalized = (status ?? "").toUpperCase();
  if (["PAYE", "PRET", "VALIDE", "VALIDEE", "COMPLET", "ACTIF"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (["EN_RETARD", "ACTION_REQUISE", "NON_PAYE", "REJETE", "INCOMPLET", "ANNULEE", "SUSPENDUE"].includes(normalized)) return "bg-rose-100 text-rose-800";
  if (["PARTIELLEMENT_PAYE", "EN_SUIVI", "NON_FACTURE", "EN_ATTENTE_VERIFICATION", "FOURNI", "FACTURE", "INSCRIT", "EN_ATTENTE"].includes(normalized)) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Une erreur est survenue.";
}

export default function EleveDossierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { info } = useInfo();
  const service = useMemo(() => new EleveService(), []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EleveDossierData | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        if (active) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const result = await service.getDossier(id);
        if (!active) return;
        setData((result.data ?? null) as EleveDossierData | null);
      } catch (error) {
        if (!active) return;
        info(getErrorMessage(error), "error");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [id, info, service]);

  const fullName = useMemo(
    () => [data?.eleve.prenom, data?.eleve.nom].filter(Boolean).join(" ").trim() || "Eleve",
    [data?.eleve.nom, data?.eleve.prenom],
  );

  return (
    <ERPPage
      title="Dossier eleve"
      description="Vue contextuelle du dossier eleve, de son inscription courante et de ses rattachements."
      backButton={{ to: "/scolarite/eleves", label: "Retour aux eleves" }}
      headerActions={[
        data?.current_inscription ? (
          <button
            key="resume"
            type="button"
            onClick={() => navigate(`/scolarite/inscriptions/${data.current_inscription?.id}/resume`)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Resume d'inscription
          </button>
        ) : null,
      ]}
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-800">
          Impossible de charger le dossier eleve.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-xl font-semibold text-slate-500">
                  {data.eleve.photo_url ? (
                    <img src={data.eleve.photo_url} alt={fullName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{fullName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-slate-950">{fullName}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      Matricule: {data.eleve.code_eleve ?? "Non genere"}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(data.eleve.statut)}`}>
                      {data.eleve.statut ?? "Statut inconnu"}
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                      Annee courante: {data.current_year?.nom ?? "Non definie"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Entre le {formatDate(data.eleve.date_entree)}.
                  </p>
                </div>
              </div>

              <div className="min-w-[240px] rounded-3xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Inscription courante</p>
                <p className="mt-2 text-xl font-semibold">
                  {data.current_inscription?.classe?.nom ?? data.current_inscription?.niveau?.nom ?? "Aucune inscription active"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {data.current_inscription?.annee?.nom ?? "Annee non renseignee"} - {data.current_inscription?.statut ?? "Sans statut"}
                </p>
                {data.current_inscription?.id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/scolarite/inscriptions/${data.current_inscription?.id}/resume`)}
                    className="mt-4 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Ouvrir le resume
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card title="Identite">
              <InfoLine label="Date de naissance" value={formatDate(data.eleve.date_naissance)} />
              <InfoLine label="Genre" value={data.eleve.genre ?? "Non renseigne"} />
              <InfoLine label="Telephone" value={data.eleve.telephone ?? "Non renseigne"} />
              <InfoLine label="Email" value={data.eleve.email ?? "Non renseigne"} />
              <InfoLine label="Adresse" value={data.eleve.adresse ?? "Non renseignee"} />
            </Card>

            <Card title="Inscription courante">
              <InfoLine label="Annee" value={data.current_inscription?.annee?.nom ?? "Non renseignee"} />
              <InfoLine label="Type" value={data.current_inscription?.type_inscription ?? "Non renseigne"} />
              <InfoLine label="Niveau" value={data.current_inscription?.niveau?.nom ?? "Non renseigne"} />
              <InfoLine label="Classe" value={data.current_inscription?.classe?.nom ?? "Non affectee"} />
              <InfoLine label="Site" value={data.current_inscription?.classe?.site ?? "Non renseigne"} />
              <InfoLine label="Date inscription" value={formatDate(data.current_inscription?.date_inscription)} />
            </Card>

            <Card title="Finance courante">
              <InfoLine label="Total facture" value={formatMoney(data.finance.total_facture)} />
              <InfoLine label="Total paye" value={formatMoney(data.finance.total_paye)} />
              <InfoLine label="Reste a payer" value={formatMoney(data.finance.reste_a_payer)} />
              <InfoLine label="Nombre de factures" value={String(data.finance.nombre_factures ?? 0)} />
              <InfoLine
                label="Dernier paiement"
                value={
                  data.finance.dernier_paiement
                    ? `${formatMoney(data.finance.dernier_paiement.montant)} le ${formatDate(data.finance.dernier_paiement.date)}`
                    : "Aucun"
                }
              />
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Responsables">
              {data.responsables.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun responsable lie pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {data.responsables.map((responsable) => (
                    <div key={responsable.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{responsable.nom_complet}</p>
                        <div className="flex flex-wrap gap-2">
                          {responsable.est_principal ? <RoleBadge label="Principal" /> : null}
                          {responsable.est_responsable_legal ? <RoleBadge label="Legal" /> : null}
                          {responsable.est_responsable_financier ? <RoleBadge label="Financier" /> : null}
                          {responsable.est_contact_urgence ? <RoleBadge label="Urgence" /> : null}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {responsable.relation ?? "Lien non renseigne"} - {responsable.telephone_principal ?? "Sans telephone"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {responsable.email ?? responsable.adresse ?? "Informations complementaires non renseignees"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Identifiants eleve">
              {data.identifiants.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun identifiant complementaire enregistre.</p>
              ) : (
                <div className="space-y-3">
                  {data.identifiants.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.type ?? "Identifiant"}</p>
                      <p className="mt-1 font-medium text-slate-900">{item.valeur ?? "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Historique des inscriptions">
              {data.inscriptions.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune inscription historique disponible.</p>
              ) : (
                <div className="space-y-3">
                  {data.inscriptions.map((inscription) => (
                    <div key={inscription.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {inscription.annee?.nom ?? "Annee non renseignee"} - {inscription.classe?.nom ?? inscription.niveau?.nom ?? "Affectation non renseignee"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {inscription.type_inscription ?? "Type non renseigne"} - inscrite le {formatDate(inscription.date_inscription)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(inscription.statut)}`}>
                            {inscription.statut ?? "Inconnue"}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate(`/scolarite/inscriptions/${inscription.id}/resume`)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Ouvrir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Medical et securite">
              <div className={`rounded-2xl border px-4 py-4 text-sm ${data.medical.authorized ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                <p className="font-medium">{data.medical.authorized ? "Acces autorise" : "Acces restreint"}</p>
                <p className="mt-1">{data.medical.note ?? "Aucune information medicale detaillee disponible."}</p>
              </div>

              {data.medical.authorized && data.medical.data ? (
                <div className="mt-4 space-y-2">
                  <InfoLine label="Groupe sanguin" value={data.medical.data.groupe_sanguin ?? "Non renseigne"} />
                  <InfoLine label="Allergies" value={data.medical.data.allergies ?? "Non renseigne"} />
                  <InfoLine label="Maladies" value={data.medical.data.maladies_particulieres ?? "Non renseigne"} />
                  <InfoLine label="Traitement" value={data.medical.data.traitement_medical ?? "Non renseigne"} />
                  <InfoLine label="Medecin" value={data.medical.data.medecin_traitant ?? "Non renseigne"} />
                  <InfoLine label="Telephone medecin" value={data.medical.data.telephone_medecin ?? "Non renseigne"} />
                  <InfoLine
                    label="Autorisation prise en charge"
                    value={data.medical.data.autorisation_prise_en_charge_medicale ? "Oui" : "Non"}
                  />
                </div>
              ) : null}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Pieces jointes eleve">
              {data.fichiers.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune piece jointe rattachee directement a l'eleve.</p>
              ) : (
                <div className="space-y-3">
                  {data.fichiers.map((file) => (
                    <div key={file.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{file.tag ?? file.type_entite ?? "Document"}</p>
                      <p className="mt-1 break-all text-slate-500">{file.nom_fichier ?? file.chemin ?? "Chemin non renseigne"}</p>
                      <p className="mt-1 text-xs text-slate-400">Ajoute le {formatDate(file.televerse_le)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Actions">
              <div className="flex flex-wrap gap-3">
                {data.current_inscription?.id ? (
                  <ActionButton
                    label="Ouvrir le resume d'inscription"
                    onClick={() => navigate(`/scolarite/inscriptions/${data.current_inscription?.id}/resume`)}
                    tone="primary"
                  />
                ) : null}
                <ActionButton
                  label="Retour a la liste des eleves"
                  onClick={() => navigate("/scolarite/eleves")}
                  tone="neutral"
                />
              </div>
            </Card>
          </section>
        </div>
      )}
    </ERPPage>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
      {label}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: "primary" | "neutral";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
        tone === "primary"
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
