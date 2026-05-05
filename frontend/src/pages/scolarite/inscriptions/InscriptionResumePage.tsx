import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import InscriptionService from "../../../services/inscription.service";
import ClasseService from "../../../services/classe.service";
import {
  getFinanceModulePath,
  queueFinanceNavigationTarget,
} from "../../finance/utils/crossNavigation";
import {
  downloadInscriptionResumePdf,
  previewInscriptionResumePdf,
} from "./utils/inscriptionPdf";

type ResumeData = {
  inscription: {
    id: string;
    statut: string;
    type_inscription?: string | null;
    statut_administratif?: string | null;
    statut_financier?: string | null;
    statut_dossier?: string | null;
    date_inscription: string | Date | null;
    validation_date?: string | Date | null;
    completion_rate: number;
    can_validate?: boolean;
    validation_blockers?: string[];
    operational_status: string;
  };
  eleve: {
    id: string;
    code_eleve?: string | null;
    prenom?: string | null;
    nom?: string | null;
    date_naissance?: string | Date | null;
    lieu_naissance?: string | null;
    nationalite?: string | null;
    genre?: string | null;
    photo_url?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
    contact_urgence?: Record<string, unknown> | null;
  };
  scolarite: {
    annee?: { id?: string | null; nom?: string | null; est_active?: boolean | null } | null;
    niveau?: { id?: string | null; nom?: string | null } | null;
    classe?: {
      id?: string | null;
      nom?: string | null;
      niveau?: string | null;
      site?: string | null;
      occupancy?: number | null;
      capacity?: number | null;
      remaining?: number | null;
      occupancy_rate?: number | null;
      is_full?: boolean | null;
      is_nearly_full?: boolean | null;
    } | null;
  };
  responsables: Array<{
    id: string;
    nom_complet: string;
    relation?: string | null;
    telephone_principal?: string | null;
    telephone_secondaire?: string | null;
    email?: string | null;
    adresse?: string | null;
    profession?: string | null;
    lieu_travail?: string | null;
    est_principal?: boolean;
    est_responsable_legal?: boolean;
    est_responsable_financier?: boolean;
    est_contact_urgence?: boolean;
  }>;
  finance: {
    target_facture_id?: string | null;
    plan_paiement_id?: string | null;
    total_facture: number;
    total_paye: number;
    reste_a_payer: number;
    statut: string;
    minimum_payment_rule?: {
      mode: string;
      value: number;
      required_amount: number;
      missing_amount: number;
      satisfied: boolean;
      registration_fee_amount?: number;
      first_school_installment_amount?: number;
    } | null;
    due_soon_threshold_days?: number | null;
    estimated_overdue_penalty_total?: number | null;
    nombre_factures: number;
    dernier_paiement?: {
      montant: number;
      date: string | Date;
      methode?: string | null;
      numero_recu?: string | null;
    } | null;
    prochaine_echeance?: {
      libelle?: string | null;
      date_echeance: string | Date;
      montant_prevu: number;
      montant_restant: number;
      statut: string;
      jours_avant_echeance?: number | null;
      facture_numero?: string | null;
    } | null;
    echeances: Array<{
      id: string;
      ordre: number;
      libelle?: string | null;
      date_echeance: string | Date;
      montant_prevu: number;
      montant_regle: number;
      montant_restant: number;
      statut: string;
      date_paiement?: string | Date | null;
      retard_jours?: number | null;
      penalite_estimee?: number | null;
      facture_numero?: string | null;
    }>;
  };
  documents: {
    supported: boolean;
    status: string;
    note?: string | null;
    items?: Array<{
      id: string;
      code: string;
      nom: string;
      description?: string | null;
      obligatoire: boolean;
      fourni: boolean;
      statut: string;
      date_depot?: string | Date | null;
      date_verification?: string | Date | null;
      commentaire_admin?: string | null;
      fichier?: {
        id: string;
        chemin?: string | null;
        nom_fichier?: string | null;
        type_mime?: string | null;
        televerse_le?: string | Date | null;
      } | null;
    }>;
    linked_files?: Array<{
      id: string;
      tag?: string | null;
      type_entite?: string | null;
      chemin?: string | null;
      nom_fichier?: string | null;
      type_mime?: string | null;
      televerse_le?: string | Date | null;
    }>;
  };
  medical: {
    supported: boolean;
    authorized: boolean;
    editable: boolean;
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
  school_history: {
    supported: boolean;
    editable: boolean;
    note?: string | null;
    data?: {
      ancien_etablissement?: string | null;
      ancienne_classe?: string | null;
      annee_precedente?: string | null;
      derniere_moyenne?: number | null;
      decision_precedente?: string | null;
      mention_precedente?: string | null;
      motif_transfert?: string | null;
      observations?: string | null;
      reprise_auto?: boolean;
    } | null;
  };
  alerts: Array<{
    id: string;
    type: string;
    gravity: "high" | "medium" | "low";
    message: string;
    actionLabel?: string | null;
  }>;
  quick_actions: Array<{
    id: string;
    label: string;
    path: string;
    tone?: "primary" | "warning" | "neutral";
  }>;
};

type ClasseOption = {
  id: string;
  nom: string;
  annee_scolaire_id?: string | null;
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

function describeMinimumPaymentRule(rule?: ResumeData["finance"]["minimum_payment_rule"] | null) {
  if (!rule) return "Aucun minimum";
  if (rule.mode === "PERCENT") {
    return `${Number(rule.value ?? 0).toLocaleString("fr-FR")}% du total facture`;
  }
  if (rule.mode === "AMOUNT") {
    return formatMoney(rule.required_amount ?? rule.value ?? 0);
  }
  if (rule.mode === "INSCRIPTION_FEE") {
    return "Droit d'inscription paye";
  }
  if (rule.mode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE") {
    return "Droit d'inscription + 1re tranche de scolarite";
  }
  return "Aucun minimum";
}

function getStatusClasses(status?: string | null) {
  const normalized = (status ?? "").toUpperCase();
  if (["PAYE", "PRET", "VALIDE", "VALIDEE", "COMPLET"].includes(normalized)) return "bg-emerald-100 text-emerald-800";
  if (["EN_RETARD", "ACTION_REQUISE", "NON_PAYE", "REJETE", "INCOMPLET"].includes(normalized)) return "bg-rose-100 text-rose-800";
  if (["PARTIELLEMENT_PAYE", "EN_SUIVI", "NON_FACTURE", "EN_ATTENTE_VERIFICATION", "FOURNI", "FACTURE"].includes(normalized)) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function getAlertClasses(gravity?: string) {
  if (gravity === "high") return "border-rose-200 bg-rose-50 text-rose-800";
  if (gravity === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getValidationButtonState(
  inscription: ResumeData["inscription"],
  validatingEnrollment: boolean,
) {
  if (validatingEnrollment) {
    return {
      label: "Validation...",
      title: "Validation de l'inscription en cours.",
      disabled: true,
      className: "bg-emerald-600 text-white",
    };
  }

  const statut = (inscription.statut ?? "").toUpperCase();
  const statutAdministratif = (inscription.statut_administratif ?? "").toUpperCase();

  if (statut === "VALIDEE" || statutAdministratif === "VALIDE") {
    return {
      label: "Inscription validee",
      title: inscription.validation_date
        ? `Inscription validee le ${formatDate(inscription.validation_date)}`
        : "Cette inscription est deja validee.",
      disabled: true,
      className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (["ANNULEE", "SORTI"].includes(statut) || statutAdministratif === "ANNULE") {
    return {
      label: statut === "SORTI" ? "Inscription close" : "Inscription annulee",
      title: "Cette inscription ne peut plus etre validee dans son etat actuel.",
      disabled: true,
      className: "border border-rose-200 bg-rose-50 text-rose-800",
    };
  }

  if (inscription.can_validate) {
    return {
      label: "Valider l'inscription",
      title: "Valider l'inscription",
      disabled: false,
      className: "bg-emerald-600 text-white hover:bg-emerald-500",
    };
  }

  const blockersLabel =
    (inscription.validation_blockers ?? []).slice(0, 2).join(" ") ||
    "Des actions restent requises avant validation.";

  return {
    label: "Validation en attente",
    title: blockersLabel,
    disabled: true,
    className: "border border-amber-200 bg-amber-50 text-amber-800",
  };
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

export default function InscriptionResumePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new InscriptionService(), []);
  const classeService = useMemo(() => new ClasseService(), []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResumeData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [validatingEnrollment, setValidatingEnrollment] = useState(false);
  const [cancellingEnrollment, setCancellingEnrollment] = useState(false);
  const [activeFileActionKey, setActiveFileActionKey] = useState<string | null>(null);
  const [documentComments, setDocumentComments] = useState<Record<string, string>>({});
  const [savingMedical, setSavingMedical] = useState(false);
  const [savingSchoolHistory, setSavingSchoolHistory] = useState(false);
  const [changingClass, setChangingClass] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<"preview" | "download" | null>(null);
  const [medicalForm, setMedicalForm] = useState({
    groupe_sanguin: "",
    allergies: "",
    maladies_particulieres: "",
    traitement_medical: "",
    medecin_traitant: "",
    telephone_medecin: "",
    autorisation_prise_en_charge_medicale: false,
    personne_a_contacter_urgence: "",
    telephone_urgence: "",
  });
  const [schoolHistoryForm, setSchoolHistoryForm] = useState({
    ancien_etablissement: "",
    ancienne_classe: "",
    annee_precedente: "",
    derniere_moyenne: "",
    decision_precedente: "",
    mention_precedente: "",
    motif_transfert: "",
    observations: "",
    reprise_auto: false,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id || !etablissement_id) {
        if (active) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const result = await service.getResume(id);
        if (!active) return;
        setData((result.data ?? null) as ResumeData | null);
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
  }, [etablissement_id, id, info, reloadKey, service]);

  useEffect(() => {
    const nextComments = Object.fromEntries(
      (data?.documents.items ?? []).map((item) => [item.id, item.commentaire_admin ?? ""]),
    );
    setDocumentComments(nextComments);
  }, [data?.documents.items]);

  useEffect(() => {
    setMedicalForm({
      groupe_sanguin: data?.medical.data?.groupe_sanguin ?? "",
      allergies: data?.medical.data?.allergies ?? "",
      maladies_particulieres: data?.medical.data?.maladies_particulieres ?? "",
      traitement_medical: data?.medical.data?.traitement_medical ?? "",
      medecin_traitant: data?.medical.data?.medecin_traitant ?? "",
      telephone_medecin: data?.medical.data?.telephone_medecin ?? "",
      autorisation_prise_en_charge_medicale: Boolean(data?.medical.data?.autorisation_prise_en_charge_medicale),
      personne_a_contacter_urgence: data?.medical.data?.personne_a_contacter_urgence ?? "",
      telephone_urgence: data?.medical.data?.telephone_urgence ?? "",
    });
  }, [data?.medical.data]);

  useEffect(() => {
    setSchoolHistoryForm({
      ancien_etablissement: data?.school_history.data?.ancien_etablissement ?? "",
      ancienne_classe: data?.school_history.data?.ancienne_classe ?? "",
      annee_precedente: data?.school_history.data?.annee_precedente ?? "",
      derniere_moyenne:
        data?.school_history.data?.derniere_moyenne != null
          ? String(data.school_history.data.derniere_moyenne)
          : "",
      decision_precedente: data?.school_history.data?.decision_precedente ?? "",
      mention_precedente: data?.school_history.data?.mention_precedente ?? "",
      motif_transfert: data?.school_history.data?.motif_transfert ?? "",
      observations: data?.school_history.data?.observations ?? "",
      reprise_auto: Boolean(data?.school_history.data?.reprise_auto),
    });
  }, [data?.school_history.data]);

  const fullName = useMemo(() => {
    return [data?.eleve?.prenom, data?.eleve?.nom].filter(Boolean).join(" ").trim() || "Eleve";
  }, [data?.eleve?.nom, data?.eleve?.prenom]);
  const validationButtonState = useMemo(
    () => (data ? getValidationButtonState(data.inscription, validatingEnrollment) : null),
    [data, validatingEnrollment],
  );
  const secondaryQuickActions = useMemo(
    () => (data?.quick_actions ?? []).filter((action) => !["register-payment", "assign-class"].includes(action.id)),
    [data?.quick_actions],
  );

  const structuredDocuments = data?.documents.items ?? [];

  const refreshResume = () => {
    setReloadKey((current) => current + 1);
  };

  const handleQuickAction = (action: ResumeData["quick_actions"][number]) => {
    if (action.id === "register-payment") {
      void handleRegisterPayment();
      return;
    }

    if (action.id === "assign-class") {
      void handleClassAssignment();
      return;
    }

    if (action.id === "manage-documents") {
      document.getElementById("inscription-documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    navigate(action.path);
  };

  const handleRegisterPayment = async () => {
    const targetFactureId = data?.finance.target_facture_id;
    if (!targetFactureId) {
      info("Aucune facture ouverte n'est disponible pour cet encaissement.", "warning");
      return;
    }

    queueFinanceNavigationTarget({
      module: "paiements",
      view: "add",
      record: {
        facture_id: targetFactureId,
        paye_le: new Date().toISOString().slice(0, 10),
        montant:
          data?.finance.prochaine_echeance?.montant_restant ??
          data?.finance.minimum_payment_rule?.missing_amount ??
          data?.finance.reste_a_payer ??
          0,
        methode: "cash",
        reference: "",
      },
    });
    navigate(getFinanceModulePath("paiements"));
  };

  const handleOpenFacture = () => {
    const targetFactureId = data?.finance.target_facture_id;
    if (!targetFactureId) {
      info("Aucune facture cible n'est disponible pour cette inscription.", "warning");
      return;
    }

    queueFinanceNavigationTarget({
      module: "factures",
      id: targetFactureId,
      view: "detail",
    });
    navigate(getFinanceModulePath("factures"));
  };

  const handleOpenPlanPaiement = () => {
    const targetPlanId = data?.finance.plan_paiement_id;
    if (!targetPlanId) {
      info("Aucun plan de paiement n'est encore genere pour cette inscription.", "warning");
      return;
    }

    queueFinanceNavigationTarget({
      module: "plans_paiement",
      id: targetPlanId,
      view: "detail",
    });
    navigate(getFinanceModulePath("plans_paiement"));
  };

  const handleClassAssignment = async () => {
    if (!id || !etablissement_id || !data?.scolarite.annee?.id) {
      info("Impossible de charger les classes disponibles pour cette inscription.", "error");
      return;
    }

    try {
      setChangingClass(true);
      const result = await classeService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
        orderBy: JSON.stringify([{ nom: "asc" }]),
      });
      const classRows = result?.status.success ? ((result.data.data as ClasseOption[]) ?? []) : [];
      const availableClasses = classRows.filter(
        (item) =>
          item.annee_scolaire_id === data.scolarite.annee?.id &&
          item.id !== (data.scolarite.classe?.id ?? null),
      );

      if (availableClasses.length === 0) {
        info("Aucune autre classe disponible sur cette annee scolaire.", "warning");
        return;
      }

      const choices = availableClasses.map((item) => `${item.id} -> ${item.nom}`).join("\n");
      const selectedClasseId = window.prompt(
        `Entrez l'identifiant de la classe cible:\n${choices}`,
        availableClasses[0]?.id ?? "",
      )?.trim();

      if (!selectedClasseId) return;

      const selectedClasse = availableClasses.find((item) => item.id === selectedClasseId);
      if (!selectedClasse) {
        info("Classe invalide pour cette annee scolaire.", "error");
        return;
      }

      const dateEffet = window.prompt(
        "Date d'effet du changement de classe (YYYY-MM-DD)",
        new Date().toISOString().slice(0, 10),
      )?.trim();

      await service.changeClass(id, {
        classe_id: selectedClasse.id,
        date_effet: dateEffet || new Date().toISOString().slice(0, 10),
        generer_regularisation_financiere: true,
        motif: `${data.scolarite.classe?.id ? "Changement" : "Affectation"} de classe depuis le resume d'inscription vers ${selectedClasse.nom}`,
      });

      info(
        data.scolarite.classe?.id
          ? "Classe modifiee et regularisation financiere traitee."
          : "Classe affectee avec succes et regularisation financiere traitee.",
        "success",
      );
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setChangingClass(false);
    }
  };

  const handleResumePdf = (mode: "preview" | "download") => {
    if (!data) return;

    try {
      setGeneratingPdf(mode);
      if (mode === "preview") {
        const result = previewInscriptionResumePdf(data, true);
        if (!result.opened) {
          downloadInscriptionResumePdf(data);
          info("La fiche d'inscription a ete telechargee.", "warning");
          return;
        }
        info("La fiche d'inscription a ete ouverte pour impression.", "success");
        return;
      }

      downloadInscriptionResumePdf(data);
      info("La fiche d'inscription a ete telechargee en PDF.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleDocumentUpdate = async (
    documentId: string,
    payload: {
      statut?: string;
      fourni?: boolean;
      commentaire_admin?: string | null;
      date_depot?: string | Date | null;
      date_verification?: string | Date | null;
    },
  ) => {
    if (!id) return;

    try {
      setSavingDocumentId(documentId);
      await service.updateDocument(id, documentId, payload);
      info("Document d'inscription mis a jour.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSavingDocumentId(null);
    }
  };

  const handleDocumentFileUpload = async (documentId: string, file: File | null) => {
    if (!id || !file) return;

    try {
      setUploadingDocumentId(documentId);
      const contentBase64 = await readFileAsDataUrl(file);
      await service.uploadDocument(id, documentId, {
        file_name: file.name,
        mime_type: file.type || null,
        content_base64: contentBase64,
        commentaire_admin: documentComments[documentId] ?? "",
      });
      info("Fichier televerse et lie au document.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setUploadingDocumentId(null);
    }
  };

  const handleValidateEnrollment = async () => {
    if (!id) return;

    try {
      setValidatingEnrollment(true);
      await service.validateEnrollment(id);
      info("Inscription validee avec succes.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setValidatingEnrollment(false);
    }
  };

  const handleCancelEnrollment = async () => {
    if (!id || !data) return;

    const reason = window.prompt(
      "Motif d'annulation de l'inscription",
      data.inscription.statut === "ANNULEE" ? (data.inscription.validation_blockers ?? []).join(" ") : "",
    )?.trim();

    if (reason === undefined) return;

    try {
      setCancellingEnrollment(true);
      await service.cancelEnrollment(id, {
        reason: reason || "Annulation effectuee depuis le resume d'inscription.",
        date_sortie: new Date().toISOString(),
      });
      info("Inscription annulee avec succes.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setCancellingEnrollment(false);
    }
  };

  const handleMedicalSave = async () => {
    if (!id || !data?.medical.editable) return;

    try {
      setSavingMedical(true);
      await service.updateMedicalProfile(id, {
        groupe_sanguin: medicalForm.groupe_sanguin || null,
        allergies: medicalForm.allergies || null,
        maladies_particulieres: medicalForm.maladies_particulieres || null,
        traitement_medical: medicalForm.traitement_medical || null,
        medecin_traitant: medicalForm.medecin_traitant || null,
        telephone_medecin: medicalForm.telephone_medecin || null,
        autorisation_prise_en_charge_medicale: medicalForm.autorisation_prise_en_charge_medicale,
        personne_a_contacter_urgence: medicalForm.personne_a_contacter_urgence || null,
        telephone_urgence: medicalForm.telephone_urgence || null,
      });
      info("Profil medical mis a jour.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSavingMedical(false);
    }
  };

  const handleSchoolHistorySave = async () => {
    if (!id) return;

    try {
      setSavingSchoolHistory(true);
      await service.updateSchoolHistory(id, {
        ancien_etablissement: schoolHistoryForm.ancien_etablissement || null,
        ancienne_classe: schoolHistoryForm.ancienne_classe || null,
        annee_precedente: schoolHistoryForm.annee_precedente || null,
        derniere_moyenne: schoolHistoryForm.derniere_moyenne ? Number(schoolHistoryForm.derniere_moyenne) : null,
        decision_precedente: schoolHistoryForm.decision_precedente || null,
        mention_precedente: schoolHistoryForm.mention_precedente || null,
        motif_transfert: schoolHistoryForm.motif_transfert || null,
        observations: schoolHistoryForm.observations || null,
        reprise_auto: schoolHistoryForm.reprise_auto,
      });
      info("Historique scolaire mis a jour.", "success");
      refreshResume();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSavingSchoolHistory(false);
    }
  };

  const handleDocumentFileAccess = async (documentId: string, mode: "preview" | "download") => {
    if (!id) return;

    const actionKey = `document:${documentId}:${mode}`;

    try {
      setActiveFileActionKey(actionKey);
      const file = await service.fetchDocumentFile(id, documentId, { download: mode === "download" });
      openBlobFile(file.blob, file.fileName ?? undefined, mode);
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setActiveFileActionKey(null);
    }
  };

  const handleLinkedFileAccess = async (linkId: string, mode: "preview" | "download") => {
    if (!id) return;

    const actionKey = `linked:${linkId}:${mode}`;

    try {
      setActiveFileActionKey(actionKey);
      const file = await service.fetchLinkedFile(id, linkId, { download: mode === "download" });
      openBlobFile(file.blob, file.fileName ?? undefined, mode);
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setActiveFileActionKey(null);
    }
  };

  return (
    <ERPPage
      title="Resume d'inscription"
      description="Vue consolidee du dossier d'inscription courant, avec les points d'attention et les actions rapides."
      backButton={{ to: "/scolarite/inscriptions", label: "Retour aux inscriptions" }}
      headerActions={[
        data && validationButtonState ? (
          <button
            key="validate"
            type="button"
            onClick={() => void handleValidateEnrollment()}
            disabled={validationButtonState.disabled}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-90 ${validationButtonState.className}`}
            title={validationButtonState.title}
          >
            {validationButtonState.label}
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
          Impossible de charger le resume d'inscription.
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
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(data.inscription.statut)}`}>
                      {data.inscription.statut}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(data.inscription.operational_status)}`}>
                      {data.inscription.operational_status}
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                      Annee: {data.scolarite.annee?.nom ?? "Non renseignee"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Inscription enregistree le {formatDate(data.inscription.date_inscription)}.
                  </p>
                </div>
              </div>

                <div className="min-w-[220px] rounded-3xl bg-slate-950 px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Completude</p>
                <p className="mt-2 text-3xl font-semibold">{data.inscription.completion_rate}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, data.inscription.completion_rate))}%` }}
                  />
                </div>
                {data.inscription.can_validate ? (
                  <p className="mt-3 text-xs text-emerald-300">Le dossier peut etre valide des maintenant.</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-300">
                    {(data.inscription.validation_blockers ?? []).slice(0, 2).join(" ") || "Des actions restent requises avant validation."}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card title="Identite">
              <InfoLine label="Date de naissance" value={formatDate(data.eleve.date_naissance)} />
              <InfoLine label="Lieu de naissance" value={data.eleve.lieu_naissance ?? "Non renseigne"} />
              <InfoLine label="Nationalite" value={data.eleve.nationalite ?? "Non renseignee"} />
              <InfoLine label="Genre" value={data.eleve.genre ?? "Non renseigne"} />
              <InfoLine label="Telephone" value={data.eleve.telephone ?? "Non renseigne"} />
              <InfoLine label="Email" value={data.eleve.email ?? "Non renseigne"} />
              <InfoLine label="Adresse" value={data.eleve.adresse ?? "Non renseignee"} />
            </Card>

            <Card title="Scolarite">
              <InfoLine label="Annee scolaire" value={data.scolarite.annee?.nom ?? "Non renseignee"} />
              <InfoLine label="Type d'inscription" value={data.inscription.type_inscription ?? "Non renseigne"} />
              <InfoLine label="Niveau" value={data.scolarite.niveau?.nom ?? data.scolarite.classe?.niveau ?? "Non affecte"} />
              <InfoLine label="Classe" value={data.scolarite.classe?.nom ?? "Non affectee"} />
              <InfoLine label="Site" value={data.scolarite.classe?.site ?? "Non renseigne"} />
              <InfoLine
                label="Effectif actuel"
                value={data.scolarite.classe?.occupancy != null ? String(data.scolarite.classe.occupancy) : "Non calcule"}
              />
              <InfoLine
                label="Capacite"
                value={data.scolarite.classe?.capacity != null ? String(data.scolarite.classe.capacity) : "Non renseignee"}
              />
              <InfoLine
                label="Places restantes"
                value={data.scolarite.classe?.remaining != null ? String(data.scolarite.classe.remaining) : "Non calculees"}
              />
              <InfoLine
                label="Occupation"
                value={data.scolarite.classe?.occupancy_rate != null ? `${data.scolarite.classe.occupancy_rate}%` : "Non calculee"}
              />
              {data.scolarite.classe?.is_full ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                  Cette classe a atteint sa capacite.
                </div>
              ) : data.scolarite.classe?.is_nearly_full ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Cette classe est presque pleine.
                </div>
              ) : null}
            </Card>

            <Card title="Finance">
              <InfoLine label="Total facture" value={formatMoney(data.finance.total_facture)} />
              <InfoLine label="Total paye" value={formatMoney(data.finance.total_paye)} />
              <InfoLine label="Reste a payer" value={formatMoney(data.finance.reste_a_payer)} />
              <InfoLine label="Statut financier" value={data.finance.statut} />
              <InfoLine
                label="Politique appliquee"
                value={describeMinimumPaymentRule(data.finance.minimum_payment_rule)}
              />
              <InfoLine
                label="Paiement minimum requis"
                value={formatMoney(data.finance.minimum_payment_rule?.required_amount ?? 0)}
              />
              <InfoLine
                label="Ecart avant validation"
                value={formatMoney(data.finance.minimum_payment_rule?.missing_amount ?? 0)}
              />
              <InfoLine
                label="Penalites estimees"
                value={formatMoney(data.finance.estimated_overdue_penalty_total ?? 0)}
              />
              <InfoLine
                label="Dernier paiement"
                value={
                  data.finance.dernier_paiement
                    ? `${formatMoney(data.finance.dernier_paiement.montant)} le ${formatDate(data.finance.dernier_paiement.date)}`
                    : "Aucun"
                }
              />
              {data.finance.minimum_payment_rule && !data.finance.minimum_payment_rule.satisfied ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Le paiement minimum requis pour valider l'inscription n'est pas encore atteint.
                </div>
              ) : null}
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
                      {responsable.profession || responsable.lieu_travail ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {[responsable.profession, responsable.lieu_travail].filter(Boolean).join(" - ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Contact d'urgence">
              {data.eleve.contact_urgence ? (
                <div className="space-y-2 text-sm text-slate-700">
                  {Object.entries(data.eleve.contact_urgence).map(([key, value]) => (
                    <InfoLine key={key} label={key} value={String(value ?? "") || "Non renseigne"} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun contact d'urgence detaille dans le dossier.</p>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Echeancier">
              {data.finance.echeances.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune echeance disponible sur cette inscription.</p>
              ) : (
                <div className="space-y-3">
                  {data.finance.echeances.slice(0, 6).map((echeance) => (
                    <div key={echeance.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{echeance.libelle ?? `Tranche ${echeance.ordre}`}</p>
                          <p className="text-sm text-slate-500">
                            Echeance au {formatDate(echeance.date_echeance)}
                            {echeance.facture_numero ? ` - ${echeance.facture_numero}` : ""}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(echeance.statut)}`}>
                          {echeance.statut}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MiniStat label="Prevu" value={formatMoney(echeance.montant_prevu)} />
                        <MiniStat label="Regle" value={formatMoney(echeance.montant_regle)} />
                        <MiniStat label="Restant" value={formatMoney(echeance.montant_restant)} />
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <MiniStat label="Paiement" value={formatDate(echeance.date_paiement)} />
                        <MiniStat label="Retard" value={`${Number(echeance.retard_jours ?? 0)} j`} />
                        <MiniStat label="Penalite" value={formatMoney(echeance.penalite_estimee ?? 0)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Alertes">
              {data.alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  Aucun signal bloquant detecte sur ce dossier.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className={`rounded-2xl border px-4 py-3 text-sm ${getAlertClasses(alert.gravity)}`}>
                      <p className="font-semibold">{alert.type}</p>
                      <p className="mt-1">{alert.message}</p>
                      {alert.actionLabel ? <p className="mt-2 text-xs font-medium">Action recommandee: {alert.actionLabel}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Historique scolaire">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Etat actuel</p>
                <p className="mt-1">{data.school_history.note ?? "Aucun historique scolaire renseigne."}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FormField
                  label="Ancien etablissement"
                  value={schoolHistoryForm.ancien_etablissement}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, ancien_etablissement: value }))}
                />
                <FormField
                  label="Ancienne classe"
                  value={schoolHistoryForm.ancienne_classe}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, ancienne_classe: value }))}
                />
                <FormField
                  label="Annee precedente"
                  value={schoolHistoryForm.annee_precedente}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, annee_precedente: value }))}
                />
                <FormField
                  label="Derniere moyenne"
                  value={schoolHistoryForm.derniere_moyenne}
                  type="number"
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, derniere_moyenne: value }))}
                />
                <FormField
                  label="Decision precedente"
                  value={schoolHistoryForm.decision_precedente}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, decision_precedente: value }))}
                />
                <FormField
                  label="Mention precedente"
                  value={schoolHistoryForm.mention_precedente}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, mention_precedente: value }))}
                />
              </div>

              <div className="mt-3 space-y-3">
                <TextAreaField
                  label="Motif de transfert"
                  value={schoolHistoryForm.motif_transfert}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, motif_transfert: value }))}
                />
                <TextAreaField
                  label="Observations"
                  value={schoolHistoryForm.observations}
                  onChange={(value) => setSchoolHistoryForm((current) => ({ ...current, observations: value }))}
                />
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={schoolHistoryForm.reprise_auto}
                    onChange={(event) =>
                      setSchoolHistoryForm((current) => ({ ...current, reprise_auto: event.target.checked }))
                    }
                  />
                  Historique repris automatiquement depuis une annee precedente
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <ActionButton
                  label={savingSchoolHistory ? "Enregistrement..." : "Enregistrer l'historique"}
                  onClick={() => {
                    void handleSchoolHistorySave();
                  }}
                  disabled={savingSchoolHistory}
                  tone="primary"
                />
              </div>
            </Card>

            <Card title="Medical et securite">
              <div className={`rounded-2xl border px-4 py-4 text-sm ${getAlertClasses(data.medical.authorized && (medicalForm.allergies || medicalForm.maladies_particulieres) ? "high" : "low")}`}>
                <p className="font-medium">{data.medical.authorized ? "Acces autorise" : "Acces restreint"}</p>
                <p className="mt-1">{data.medical.note ?? "Aucune information medicale detaillee disponible."}</p>
              </div>

              {data.medical.authorized ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <FormField
                      label="Groupe sanguin"
                      value={medicalForm.groupe_sanguin}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, groupe_sanguin: value }))}
                    />
                    <FormField
                      label="Medecin traitant"
                      value={medicalForm.medecin_traitant}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, medecin_traitant: value }))}
                    />
                    <FormField
                      label="Telephone medecin"
                      value={medicalForm.telephone_medecin}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, telephone_medecin: value }))}
                    />
                    <FormField
                      label="Personne d'urgence"
                      value={medicalForm.personne_a_contacter_urgence}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, personne_a_contacter_urgence: value }))}
                    />
                    <FormField
                      label="Telephone d'urgence"
                      value={medicalForm.telephone_urgence}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, telephone_urgence: value }))}
                    />
                  </div>

                  <div className="mt-3 space-y-3">
                    <TextAreaField
                      label="Allergies"
                      value={medicalForm.allergies}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, allergies: value }))}
                    />
                    <TextAreaField
                      label="Maladies particulieres"
                      value={medicalForm.maladies_particulieres}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, maladies_particulieres: value }))}
                    />
                    <TextAreaField
                      label="Traitement medical"
                      value={medicalForm.traitement_medical}
                      onChange={(value) => setMedicalForm((current) => ({ ...current, traitement_medical: value }))}
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={medicalForm.autorisation_prise_en_charge_medicale}
                        onChange={(event) =>
                          setMedicalForm((current) => ({
                            ...current,
                            autorisation_prise_en_charge_medicale: event.target.checked,
                          }))
                        }
                      />
                      Autorisation de prise en charge medicale
                    </label>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <ActionButton
                      label={savingMedical ? "Enregistrement..." : "Enregistrer le profil medical"}
                      onClick={() => {
                        void handleMedicalSave();
                      }}
                      disabled={savingMedical}
                      tone="primary"
                    />
                  </div>
                </>
              ) : null}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card title="Documents" sectionId="inscription-documents">
              <div className={`rounded-2xl border px-4 py-4 text-sm ${getAlertClasses(data.documents.status === "VALIDE" || data.documents.status === "COMPLET" ? "low" : "medium")}`}>
                <p className="font-semibold">Etat actuel</p>
                <p className="mt-1">{data.documents.note ?? "Module documentaire non detaille."}</p>
              </div>

              {structuredDocuments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {structuredDocuments.map((item) => {
                    const comment = documentComments[item.id] ?? "";
                    const isSaving = savingDocumentId === item.id;

                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">{item.nom}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {item.obligatoire ? "Obligatoire" : "Optionnel"} - {item.code}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(item.statut)}`}>
                            {item.statut}
                          </span>
                        </div>

                        {item.description ? (
                          <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <MiniStat label="Depot" value={formatDate(item.date_depot)} />
                          <MiniStat label="Verification" value={formatDate(item.date_verification)} />
                        </div>

                        {item.fichier?.chemin ? (
                          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            <p className="font-medium text-slate-900">Fichier lie</p>
                            <p className="mt-1 break-all">{item.fichier.nom_fichier ?? item.fichier.chemin}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">{item.fichier.chemin}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ActionButton
                                label={activeFileActionKey === `document:${item.id}:preview` ? "Ouverture..." : "Ouvrir"}
                                onClick={() => {
                                  void handleDocumentFileAccess(item.id, "preview");
                                }}
                                disabled={activeFileActionKey !== null}
                                tone="neutral"
                              />
                              <ActionButton
                                label={activeFileActionKey === `document:${item.id}:download` ? "Telechargement..." : "Telecharger"}
                                onClick={() => {
                                  void handleDocumentFileAccess(item.id, "download");
                                }}
                                disabled={activeFileActionKey !== null}
                                tone="primary"
                              />
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Televerser un fichier
                          </label>
                          <input
                            type="file"
                            disabled={uploadingDocumentId === item.id}
                            onChange={(event) => {
                              const selectedFile = event.target.files?.[0] ?? null;
                              void handleDocumentFileUpload(item.id, selectedFile);
                              event.currentTarget.value = "";
                            }}
                            className="block w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
                          />
                          {uploadingDocumentId === item.id ? (
                            <p className="mt-2 text-xs text-slate-500">Televersement en cours...</p>
                          ) : null}
                        </div>

                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Commentaire administratif
                          </label>
                          <textarea
                            value={comment}
                            onChange={(event) =>
                              setDocumentComments((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                            placeholder="Commentaire, observation ou motif de rejet"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <ActionButton
                            label={isSaving ? "Mise a jour..." : "Marquer fourni"}
                            onClick={() =>
                              handleDocumentUpdate(item.id, {
                                statut: "FOURNI",
                                fourni: true,
                                date_depot: item.date_depot ?? new Date().toISOString(),
                                commentaire_admin: comment,
                              })
                            }
                            disabled={isSaving}
                            tone="neutral"
                          />
                          <ActionButton
                            label={isSaving ? "Mise a jour..." : "Valider"}
                            onClick={() =>
                              handleDocumentUpdate(item.id, {
                                statut: "VALIDE",
                                fourni: true,
                                date_depot: item.date_depot ?? new Date().toISOString(),
                                date_verification: new Date().toISOString(),
                                commentaire_admin: comment,
                              })
                            }
                            disabled={isSaving}
                            tone="primary"
                          />
                          <ActionButton
                            label={isSaving ? "Mise a jour..." : "Rejeter"}
                            onClick={() =>
                              handleDocumentUpdate(item.id, {
                                statut: "REJETE",
                                fourni: true,
                                date_depot: item.date_depot ?? new Date().toISOString(),
                                date_verification: new Date().toISOString(),
                                commentaire_admin: comment,
                              })
                            }
                            disabled={isSaving}
                            tone="warning"
                          />
                          <ActionButton
                            label={isSaving ? "Mise a jour..." : "Reinitialiser"}
                            onClick={() =>
                              handleDocumentUpdate(item.id, {
                                statut: "NON_FOURNI",
                                fourni: false,
                                commentaire_admin: comment,
                              })
                            }
                            disabled={isSaving}
                            tone="neutral"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                  Aucun document structure n'est encore initialise sur cette inscription.
                </div>
              )}

              <div className="mt-4 space-y-2">
                {(data.documents.linked_files ?? []).length === 0 ? null : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pieces jointes heritagees</p>
                    {data.documents.linked_files?.map((file) => (
                      <div key={file.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">{file.tag ?? file.type_entite ?? "Document"}</p>
                        <p className="mt-1 break-all text-slate-500">{file.nom_fichier ?? file.chemin ?? "Chemin non renseigne"}</p>
                        {file.chemin ? <p className="mt-1 break-all text-xs text-slate-400">{file.chemin}</p> : null}
                        {file.chemin ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ActionButton
                              label={activeFileActionKey === `linked:${file.id}:preview` ? "Ouverture..." : "Ouvrir"}
                              onClick={() => {
                                void handleLinkedFileAccess(file.id, "preview");
                              }}
                              disabled={activeFileActionKey !== null}
                              tone="neutral"
                            />
                            <ActionButton
                              label={activeFileActionKey === `linked:${file.id}:download` ? "Telechargement..." : "Telecharger"}
                              onClick={() => {
                                void handleLinkedFileAccess(file.id, "download");
                              }}
                              disabled={activeFileActionKey !== null}
                              tone="primary"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Card>

            <Card title="Actions rapides">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleValidateEnrollment()}
                  disabled={validationButtonState?.disabled}
                  title={validationButtonState?.title}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-90 ${
                    validationButtonState?.className ?? "border border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  {validationButtonState?.label ?? "Valider l'inscription"}
                </button>
                <ActionButton
                  label={changingClass ? "Mise a jour de la classe..." : data.scolarite.classe?.id ? "Changer de classe" : "Affecter a une classe"}
                  onClick={() => {
                    void handleClassAssignment();
                  }}
                  disabled={changingClass}
                  tone="warning"
                />
                <ActionButton
                  label="Enregistrer un paiement"
                  onClick={() => {
                    void handleRegisterPayment();
                  }}
                  disabled={!data.finance.target_facture_id}
                  tone="primary"
                />
                <ActionButton
                  label="Voir la facture"
                  onClick={handleOpenFacture}
                  disabled={!data.finance.target_facture_id}
                  tone="neutral"
                />
                <ActionButton
                  label="Voir le plan de paiement"
                  onClick={handleOpenPlanPaiement}
                  disabled={!data.finance.plan_paiement_id}
                  tone="neutral"
                />
                <ActionButton
                  label={generatingPdf === "preview" ? "Ouverture..." : "Imprimer la fiche"}
                  onClick={() => handleResumePdf("preview")}
                  disabled={generatingPdf !== null}
                  tone="neutral"
                />
                <ActionButton
                  label={generatingPdf === "download" ? "Generation..." : "Telecharger PDF"}
                  onClick={() => handleResumePdf("download")}
                  disabled={generatingPdf !== null}
                  tone="primary"
                />
                <ActionButton
                  label={cancellingEnrollment ? "Annulation..." : "Annuler l'inscription"}
                  onClick={() => {
                    void handleCancelEnrollment();
                  }}
                  disabled={cancellingEnrollment || data.inscription.statut === "ANNULEE" || data.inscription.statut === "SORTI"}
                  tone="warning"
                />
                {secondaryQuickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action)}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      action.tone === "primary"
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : action.tone === "warning"
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {!data.inscription.can_validate && (data.inscription.validation_blockers ?? []).length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <p className="font-medium">Blocages de validation</p>
                  <div className="mt-2 space-y-1">
                    {(data.inscription.validation_blockers ?? []).map((reason) => (
                      <p key={reason}>- {reason}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </section>
        </div>
      )}
    </ERPPage>
  );
}

function Card({ title, children, sectionId }: { title: string; children: React.ReactNode; sectionId?: string }) {
  return (
    <section id={sectionId} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "primary" | "warning" | "neutral";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "primary"
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : tone === "warning"
            ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
      {label}
    </span>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Impossible de lire le fichier selectionne."));
    reader.readAsDataURL(file);
  });
}

function openBlobFile(blob: Blob, fileName: string | undefined, mode: "preview" | "download") {
  const objectUrl = URL.createObjectURL(blob);

  if (mode === "download") {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName ?? "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    return;
  }

  const previewWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!previewWindow) {
    const fallbackLink = document.createElement("a");
    fallbackLink.href = objectUrl;
    fallbackLink.download = fileName ?? "document";
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
