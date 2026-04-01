import { useEffect, useMemo, useState, type FormEvent } from "react";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import FinanceRelanceService from "../../../services/financeRelance.service";
import FinanceRecouvrementService from "../../../services/financeRecouvrement.service";
import NotFound from "../../NotFound";

function readError(error: unknown, fallback: string) {
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
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function fmtDate(value?: string | Date | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return date.toLocaleDateString("fr-FR");
}

function fmtMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString("fr-FR")} MGA`;
}

export default function RecouvrementIndex() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new FinanceRecouvrementService(), []);
  const relanceService = useMemo(() => new FinanceRelanceService(), []);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);
  const [promises, setPromises] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [policyForm, setPolicyForm] = useState({ nom: "Regle de recouvrement par defaut", jours_grace: "0", relance_jours_json: "7, 15, 30", penalite_active: false, penalite_mode: "FIXED", penalite_valeur: "" });
  const [promiseForm, setPromiseForm] = useState({ facture_id: "", plan_paiement_id: "", eleve_id: "", annee_scolaire_id: "", montant_promis: "", date_limite: new Date().toISOString().slice(0, 10) });
  const [restrictionForm, setRestrictionForm] = useState({ facture_id: "", plan_paiement_id: "", eleve_id: "", annee_scolaire_id: "", type: "BULLETIN", motif: "" });
  const [caseForm, setCaseForm] = useState({ facture_id: "", plan_paiement_id: "", eleve_id: "", annee_scolaire_id: "", statut: "OUVERT", motif: "" });

  const load = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const [policyResult, promiseResult, restrictionResult, caseResult] = await Promise.all([
        service.getPolicy(),
        service.getPaymentPromises({}),
        service.getAdministrativeRestrictions({}),
        service.getCollectionCases({}),
      ]);
      const nextPolicy = policyResult?.status?.success ? policyResult.data.data : null;
      setPolicy(nextPolicy ?? null);
      setPolicyForm({
        nom: nextPolicy?.nom ?? "Regle de recouvrement par defaut",
        jours_grace: String(nextPolicy?.jours_grace ?? 0),
        relance_jours_json: Array.isArray(nextPolicy?.relance_jours_json) ? nextPolicy.relance_jours_json.join(", ") : "7, 15, 30",
        penalite_active: Boolean(nextPolicy?.penalite_active),
        penalite_mode: nextPolicy?.penalite_mode === "PERCENT" ? "PERCENT" : "FIXED",
        penalite_valeur: nextPolicy?.penalite_valeur != null ? String(nextPolicy.penalite_valeur) : "",
      });
      setPromises(promiseResult?.status?.success ? promiseResult.data.data ?? [] : []);
      setRestrictions(restrictionResult?.status?.success ? restrictionResult.data.data ?? [] : []);
      setCases(caseResult?.status?.success ? caseResult.data.data ?? [] : []);
    } catch (error) {
      info(readError(error, "Impossible de charger le recouvrement."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [etablissement_id]);

  if (!etablissement_id) return <NotFound />;

  const savePolicy = async () => {
    try {
      await service.savePolicy({
        nom: policyForm.nom,
        jours_grace: Number(policyForm.jours_grace || 0),
        relance_jours_json: policyForm.relance_jours_json.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0),
        penalite_active: policyForm.penalite_active,
        penalite_mode: policyForm.penalite_active ? (policyForm.penalite_mode as "FIXED" | "PERCENT") : null,
        penalite_valeur: policyForm.penalite_active ? Number(policyForm.penalite_valeur || 0) : null,
      });
      info("Regle de recouvrement enregistree.", "success");
      await load();
    } catch (error) {
      info(readError(error, "Impossible d'enregistrer la regle."), "error");
    }
  };

  const runCalendar = async () => {
    try {
      await relanceService.runCalendar({});
      info("Calendrier de relance execute.", "success");
    } catch (error) {
      info(readError(error, "Impossible d'executer le calendrier de relance."), "error");
    }
  };

  const submitPromise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await service.createPaymentPromise({
        facture_id: promiseForm.facture_id || null,
        plan_paiement_id: promiseForm.plan_paiement_id || null,
        eleve_id: promiseForm.eleve_id || null,
        annee_scolaire_id: promiseForm.annee_scolaire_id || null,
        montant_promis: Number(promiseForm.montant_promis || 0),
        date_limite: promiseForm.date_limite,
      });
      info("Promesse enregistree.", "success");
      setPromiseForm((current) => ({ ...current, montant_promis: "" }));
      await load();
    } catch (error) {
      info(readError(error, "Impossible d'enregistrer la promesse."), "error");
    }
  };

  const submitRestriction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await service.createAdministrativeRestriction({
        facture_id: restrictionForm.facture_id || null,
        plan_paiement_id: restrictionForm.plan_paiement_id || null,
        eleve_id: restrictionForm.eleve_id || null,
        annee_scolaire_id: restrictionForm.annee_scolaire_id || null,
        type: restrictionForm.type,
        motif: restrictionForm.motif || null,
      });
      info("Blocage cree.", "success");
      setRestrictionForm((current) => ({ ...current, motif: "" }));
      await load();
    } catch (error) {
      info(readError(error, "Impossible de creer le blocage."), "error");
    }
  };

  const submitCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await service.createCollectionCase({
        facture_id: caseForm.facture_id || null,
        plan_paiement_id: caseForm.plan_paiement_id || null,
        eleve_id: caseForm.eleve_id || null,
        annee_scolaire_id: caseForm.annee_scolaire_id || null,
        statut: caseForm.statut,
        motif: caseForm.motif || null,
      });
      info("Dossier cree.", "success");
      setCaseForm((current) => ({ ...current, motif: "" }));
      await load();
    } catch (error) {
      info(readError(error, "Impossible de creer le dossier."), "error");
    }
  };

  return (
    <FinanceModuleLayout
      title="Recouvrement"
      description="Relances, promesses de paiement, blocages administratifs et dossiers de recouvrement."
      currentModule="recouvrement"
    >
      <div className="space-y-4">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Promesses ouvertes</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{promises.filter((item) => (item.statut ?? "EN_ATTENTE") === "EN_ATTENTE").length}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Blocages actifs</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{restrictions.filter((item) => (item.statut ?? "ACTIVE") === "ACTIVE").length}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Dossiers ouverts</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{cases.filter((item) => !["CLOTURE", "ABANDONNE"].includes((item.statut ?? "").toUpperCase())).length}</p>
          </article>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Regle de recouvrement</h2>
              <p className="text-sm text-slate-500">Statut : {policy?.statut_validation ?? "NON_CONFIGUREE"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runCalendar} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Lancer le calendrier</button>
              <button type="button" onClick={() => service.approvePolicy().then(() => load())} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Approuver</button>
              <button type="button" onClick={() => service.rejectPolicy(window.prompt('Motif du rejet', policy?.motif_rejet ?? '') ?? '').then(() => load())} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white">Rejeter</button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Nom" value={policyForm.nom} onChange={(event) => setPolicyForm((current) => ({ ...current, nom: event.target.value }))} />
            <input type="number" min="0" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Jours de grace" value={policyForm.jours_grace} onChange={(event) => setPolicyForm((current) => ({ ...current, jours_grace: event.target.value }))} />
            <input className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Paliers de relance: 7, 15, 30" value={policyForm.relance_jours_json} onChange={(event) => setPolicyForm((current) => ({ ...current, relance_jours_json: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={policyForm.penalite_active} onChange={(event) => setPolicyForm((current) => ({ ...current, penalite_active: event.target.checked }))} /> Activer la penalite</label>
            <select className="rounded-2xl border border-slate-200 px-4 py-3" value={policyForm.penalite_mode} onChange={(event) => setPolicyForm((current) => ({ ...current, penalite_mode: event.target.value }))}><option value="FIXED">Montant fixe</option><option value="PERCENT">Pourcentage</option></select>
            <input type="number" min="0" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Valeur" value={policyForm.penalite_valeur} onChange={(event) => setPolicyForm((current) => ({ ...current, penalite_valeur: event.target.value }))} />
          </div>
          <button type="button" onClick={savePolicy} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">Enregistrer la regle</button>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <form onSubmit={submitPromise} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Promesse de paiement</h2>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Facture ID" value={promiseForm.facture_id} onChange={(event) => setPromiseForm((current) => ({ ...current, facture_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Plan de paiement ID" value={promiseForm.plan_paiement_id} onChange={(event) => setPromiseForm((current) => ({ ...current, plan_paiement_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Eleve ID" value={promiseForm.eleve_id} onChange={(event) => setPromiseForm((current) => ({ ...current, eleve_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Annee scolaire ID" value={promiseForm.annee_scolaire_id} onChange={(event) => setPromiseForm((current) => ({ ...current, annee_scolaire_id: event.target.value }))} />
            <input type="number" min="0" step="0.01" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Montant promis" value={promiseForm.montant_promis} onChange={(event) => setPromiseForm((current) => ({ ...current, montant_promis: event.target.value }))} />
            <input type="date" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={promiseForm.date_limite} onChange={(event) => setPromiseForm((current) => ({ ...current, date_limite: event.target.value }))} />
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">Enregistrer</button>
            <div className="space-y-2 text-sm text-slate-600">
              {loading ? <p>Chargement...</p> : null}
              {promises.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{item.id.slice(0, 8)} � {fmtMoney(item.montant_promis)}</p>
                  <p>Limite : {fmtDate(item.date_limite)} � {item.statut ?? "EN_ATTENTE"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => service.keepPaymentPromise(item.id).then(() => load())} className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">Tenue</button>
                    <button type="button" onClick={() => service.breakPaymentPromise(item.id).then(() => load())} className="rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">Rompue</button>
                    <button type="button" onClick={() => service.cancelPaymentPromise(item.id).then(() => load())} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">Annuler</button>
                  </div>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={submitRestriction} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Blocage administratif</h2>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Facture ID" value={restrictionForm.facture_id} onChange={(event) => setRestrictionForm((current) => ({ ...current, facture_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Plan de paiement ID" value={restrictionForm.plan_paiement_id} onChange={(event) => setRestrictionForm((current) => ({ ...current, plan_paiement_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Eleve ID" value={restrictionForm.eleve_id} onChange={(event) => setRestrictionForm((current) => ({ ...current, eleve_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Annee scolaire ID" value={restrictionForm.annee_scolaire_id} onChange={(event) => setRestrictionForm((current) => ({ ...current, annee_scolaire_id: event.target.value }))} />
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={restrictionForm.type} onChange={(event) => setRestrictionForm((current) => ({ ...current, type: event.target.value }))}><option value="BULLETIN">Bulletin</option><option value="EXAMEN">Examen</option><option value="REINSCRIPTION">Reinscription</option></select>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Motif" value={restrictionForm.motif} onChange={(event) => setRestrictionForm((current) => ({ ...current, motif: event.target.value }))} />
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">Creer</button>
            <div className="space-y-2 text-sm text-slate-600">
              {restrictions.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{item.type} � {item.statut ?? "ACTIVE"}</p>
                  <p>{item.motif ?? "Sans motif"}</p>
                  {(item.statut ?? "ACTIVE") === "ACTIVE" ? <button type="button" onClick={() => service.liftAdministrativeRestriction(item.id).then(() => load())} className="mt-2 rounded-full border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">Lever</button> : null}
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={submitCase} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Dossier de recouvrement</h2>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Facture ID" value={caseForm.facture_id} onChange={(event) => setCaseForm((current) => ({ ...current, facture_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Plan de paiement ID" value={caseForm.plan_paiement_id} onChange={(event) => setCaseForm((current) => ({ ...current, plan_paiement_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Eleve ID" value={caseForm.eleve_id} onChange={(event) => setCaseForm((current) => ({ ...current, eleve_id: event.target.value }))} />
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Annee scolaire ID" value={caseForm.annee_scolaire_id} onChange={(event) => setCaseForm((current) => ({ ...current, annee_scolaire_id: event.target.value }))} />
            <select className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" value={caseForm.statut} onChange={(event) => setCaseForm((current) => ({ ...current, statut: event.target.value }))}><option value="OUVERT">Ouvert</option><option value="RENFORCE">Renforce</option><option value="CONTENTIEUX">Contentieux</option><option value="IRRECOUVRABLE">Irrecouvrable</option><option value="ABANDON_EN_ATTENTE">Abandon en attente</option></select>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Motif" value={caseForm.motif} onChange={(event) => setCaseForm((current) => ({ ...current, motif: event.target.value }))} />
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">Creer</button>
            <div className="space-y-2 text-sm text-slate-600">
              {cases.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{item.statut ?? "OUVERT"} � {fmtMoney(item.montant_reference)}</p>
                  <p>{item.motif ?? "Sans motif"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['RENFORCE','CONTENTIEUX','IRRECOUVRABLE','ABANDON_EN_ATTENTE','ABANDONNE','CLOTURE'].map((status) => <button key={status} type="button" onClick={() => service.updateCollectionCaseStatus(item.id, { statut: status }).then(() => load())} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">{status}</button>)}
                  </div>
                </div>
              ))}
            </div>
          </form>
        </section>
      </div>
    </FinanceModuleLayout>
  );
}
