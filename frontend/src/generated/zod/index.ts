import { z } from "zod";

// AUTO-GENERATED FILE.
// Source: generated/zod/index.ts
// This frontend-safe build intentionally strips Prisma-specific schemas and helpers.

/////////////////////////////////////////
// FRONTEND HELPER FUNCTIONS
/////////////////////////////////////////

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), z.lazy(() => JsonValueSchema.optional())),
    z.array(z.lazy(() => JsonValueSchema)),
  ]),
);

export type JsonValueType = z.infer<typeof JsonValueSchema>;

export const NullableJsonValue = JsonValueSchema.nullable();
export type NullableJsonValueType = z.infer<typeof NullableJsonValue>;

export const InputJsonValueSchema = JsonValueSchema;
export type InputJsonValueType = z.infer<typeof InputJsonValueSchema>;

export const DecimalJsLikeSchema = z.object({
  d: z.array(z.number()),
  e: z.number(),
  s: z.number(),
  toFixed: z.any(),
});

export const DecimalValueSchema = z.union([
  z.number(),
  z.string(),
  DecimalJsLikeSchema,
]);


export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const EtablissementScalarFieldEnumSchema = z.enum(['id','nom','code','fuseau_horaire','parametres_json','created_at','updated_at']);

export const SiteScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','adresse','telephone','created_at','updated_at']);

export const AnneeScolaireScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','date_debut','date_fin','est_active','created_at','updated_at']);

export const PeriodeScalarFieldEnumSchema = z.enum(['id','annee_scolaire_id','nom','date_debut','date_fin','ordre','created_at','updated_at']);

export const SalleScalarFieldEnumSchema = z.enum(['id','site_id','nom','capacite','type','created_at','updated_at']);

export const ReferencielScalarFieldEnumSchema = z.enum(['id','titre','code']);

export const EtablissementReferencielScalarFieldEnumSchema = z.enum(['id','referenciel_id','etablissement_id','valeur','referencielId']);

export const UtilisateurScalarFieldEnumSchema = z.enum(['id','etablissement_id','email','telephone','mot_de_passe_hash','statut','dernier_login','scope_json','created_at','updated_at']);

export const ProfilScalarFieldEnumSchema = z.enum(['id','utilisateur_id','prenom','nom','date_naissance','lieu_naissance','nationalite','genre','photo_url','adresse','telephone_personnel','email_personnel','contact_urgence_json','created_at','updated_at']);

export const RoleScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','created_at','updated_at','scope_json']);

export const PermissionScalarFieldEnumSchema = z.enum(['id','etablissement_id','code','description','created_at','updated_at']);

export const RolePermissionScalarFieldEnumSchema = z.enum(['role_id','permission_id']);

export const UtilisateurRoleScalarFieldEnumSchema = z.enum(['utilisateur_id','role_id','scope_json']);

export const EleveScalarFieldEnumSchema = z.enum(['id','etablissement_id','code_eleve','utilisateur_id','statut','date_entree','created_at','updated_at']);

export const EleveMedicalProfileScalarFieldEnumSchema = z.enum(['id','eleve_id','groupe_sanguin','allergies','maladies_particulieres','traitement_medical','medecin_traitant','telephone_medecin','autorisation_prise_en_charge_medicale','personne_a_contacter_urgence','telephone_urgence','notes_json','created_at','updated_at']);

export const ParentTuteurScalarFieldEnumSchema = z.enum(['id','etablissement_id','utilisateur_id','nom_complet','telephone','telephone_secondaire','email','adresse','profession','lieu_travail','created_at','updated_at']);

export const EleveParentTuteurScalarFieldEnumSchema = z.enum(['eleve_id','parent_tuteur_id','relation','est_principal','est_responsable_legal','est_responsable_financier','est_contact_urgence','autorise_recuperation']);

export const NiveauScolaireScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','ordre','created_at','updated_at']);

export const ClasseScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','site_id','nom','capacite','enseignant_principal_id','created_at','updated_at']);

export const InscriptionScalarFieldEnumSchema = z.enum(['id','eleve_id','niveau_scolaire_id','classe_id','annee_scolaire_id','date_inscription','type_inscription','statut','statut_administratif','statut_financier','statut_dossier','validation_date','completion_rate','acces_systeme_json','consentements_json','observations_json','date_sortie','raison_sortie','created_at','updated_at']);

export const InscriptionSchoolHistoryScalarFieldEnumSchema = z.enum(['id','inscription_id','ancien_etablissement','ancienne_classe','annee_precedente','derniere_moyenne','decision_precedente','mention_precedente','motif_transfert','observations','reprise_auto','created_at','updated_at']);

export const IdentifiantEleveScalarFieldEnumSchema = z.enum(['id','eleve_id','type','valeur','delivre_le','expire_le','created_at','updated_at']);

export const PersonnelScalarFieldEnumSchema = z.enum(['id','etablissement_id','code_personnel','utilisateur_id','date_embauche','statut','poste','created_at','updated_at']);

export const EnseignantScalarFieldEnumSchema = z.enum(['id','personnel_id','departement_principal_id','created_at','updated_at']);

export const DepartementScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','created_at','updated_at']);

export const MatiereScalarFieldEnumSchema = z.enum(['id','etablissement_id','code','nom','departement_id','created_at','updated_at']);

export const PedagogicalItemScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','parent_id','matiere_id','grading_scale_id','item_type','code','nom','description','display_order','coefficient','weight','is_evaluable','is_visible_on_report','is_required','include_in_general_average','grading_mode_override','calculation_mode','is_active','created_at','updated_at']);

export const GradingScaleScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','nom','grading_type','base_score','use_for_calculation','allow_decimal','is_default','is_active','created_at','updated_at']);

export const GradingScaleLevelScalarFieldEnumSchema = z.enum(['id','grading_scale_id','code','label','numeric_value','min_value','max_value','display_order','color','is_success_level','is_active','created_at','updated_at']);

export const ProgrammeScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','code','nom','description','statut','date_debut','date_fin','est_actif','ordre_affichage','default_grading_scale_id','verrouille_le','archive_le','created_by_utilisateur_id','updated_by_utilisateur_id','created_at','updated_at']);

export const ProgrammeMatiereScalarFieldEnumSchema = z.enum(['id','programme_id','matiere_id','heures_semaine','heures_annuelles','seances_par_semaine','duree_seance_par_defaut','coefficient','est_obligatoire','est_visible_bulletin','inclure_moyenne_generale','appreciation_obligatoire','libelle_bulletin','ordre_affichage_bulletin','grading_scale_id','mode_calcul','statut','created_at','updated_at']);

export const ProgrammeChangeLogScalarFieldEnumSchema = z.enum(['id','programme_id','entity_type','entity_id','action','field_name','old_value_json','new_value_json','reason','impact_summary_json','changed_by_utilisateur_id','changed_at']);

export const CoursScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','classe_id','matiere_id','enseignant_id','coefficient_override','created_at','updated_at']);

export const TypeEvaluationRefScalarFieldEnumSchema = z.enum(['id','etablissement_id','code','nom','poids_defaut','default_max_score','include_in_average','show_in_report_card','is_final_exam','is_active','created_at','updated_at']);

export const EvaluationScalarFieldEnumSchema = z.enum(['id','cours_id','periode_id','pedagogical_item_id','grading_scale_id','type_evaluation_id','type','titre','description','date','note_max','poids','est_publiee','include_in_average','show_in_report_card','is_final_exam','status','cree_par_enseignant_id','created_at','updated_at']);

export const NoteScalarFieldEnumSchema = z.enum(['id','evaluation_id','eleve_id','score','commentaire','note_le','note_par','created_at','updated_at']);

export const AssessmentResultScalarFieldEnumSchema = z.enum(['id','assessment_id','student_id','raw_score','max_score','normalized_score','scale_level_id','text_value','display_value','status','observation','is_validated','validated_at','validated_by','created_at','updated_at']);

export const AssessmentResultHistoryScalarFieldEnumSchema = z.enum(['id','assessment_result_id','old_raw_score','new_raw_score','old_max_score','new_max_score','old_normalized_score','new_normalized_score','old_scale_level_id','new_scale_level_id','old_text_value','new_text_value','old_display_value','new_display_value','old_status','new_status','reason','changed_by','changed_at']);

export const PedagogicalItemAverageScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','periode_id','classe_id','eleve_id','pedagogical_item_id','student_average','class_average','display_value','calculation_mode','rounding_precision','status','calculated_at','created_at','updated_at']);

export const RegleNoteScalarFieldEnumSchema = z.enum(['id','etablissement_id','scope','regle_json','created_at','updated_at']);

export const ReportCardTemplateScalarFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','nom','description','template_type','pedagogical_display_mode','calculation_mode','include_code_grades_in_general_average','show_student_average','show_class_average','show_general_student_average','show_general_class_average','show_code_legend','show_section_headers','rounding_precision','base_score','exclude_non_evaluated_items','minimum_required_results','use_weights','use_coefficients','show_assessment_details','show_assessment_type_summary','show_only_final_exam','show_subjects','show_groups','show_domains','show_subdomains','show_competencies','show_objectives','show_only_evaluated_items','show_non_evaluated_items','non_evaluated_label','group_items_by_parent','show_hierarchical_indent','max_hierarchy_depth','show_subject_summary','show_domain_summary','show_subdomain_summary','show_competency_results','show_subject_average','show_subject_coefficient','show_subject_points','show_subject_rank','show_teacher_appreciation','show_general_average','show_total_coefficients','show_total_points','show_general_rank','show_mention','show_decision','show_general_appreciation','show_absences','show_late_count','show_logo','show_signature','is_default','is_active','created_at','updated_at']);

export const ReportCardTemplatePedagogicalItemScalarFieldEnumSchema = z.enum(['id','template_id','section_id','pedagogical_item_id','is_visible','custom_label','display_order','show_result','show_appreciation','show_children','grading_scale_id_override','include_in_general_average_override','created_at','updated_at']);

export const ReportCardTemplateSectionScalarFieldEnumSchema = z.enum(['id','template_id','parent_section_id','title','section_type','grading_mode','display_order','show_header','is_active','created_at','updated_at']);

export const ReportCardTemplateFieldScalarFieldEnumSchema = z.enum(['id','template_id','section_id','field_key','label','display_order','is_visible','width','alignment','created_at','updated_at']);

export const BulletinScalarFieldEnumSchema = z.enum(['id','eleve_id','periode_id','classe_id','report_card_template_id','validated_at','validated_by','publie_le','statut','general_average','general_class_average','total_coefficients','total_points','general_rank','mention','decision','general_appreciation','display_snapshot_json','display_legend_json','created_at','updated_at']);

export const BulletinLigneScalarFieldEnumSchema = z.enum(['id','bulletin_id','matiere_id','parent_ligne_id','pedagogical_item_id','item_type','grading_mode','moyenne','display_value','numeric_value','student_average','class_average','scale_level_id','observation','rang','commentaire_enseignant','display_order','is_visible','created_at','updated_at']);

export const BulletinLigneDetailScalarFieldEnumSchema = z.enum(['id','bulletin_ligne_id','assessment_id','assessment_result_id','label','display_value','numeric_value','scale_level_id','display_order','created_at','updated_at']);

export const BulletinCodeLegendScalarFieldEnumSchema = z.enum(['id','bulletin_id','grading_scale_id','code','label','numeric_value','display_order','created_at','updated_at']);

export const CreneauHoraireScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','heure_debut','heure_fin','ordre','created_at','updated_at']);

export const EmploiDuTempsScalarFieldEnumSchema = z.enum(['id','classe_id','cours_id','matiere_id','enseignant_id','salle_id','jour_semaine','heure_debut','heure_fin','creneau_horaire_id','effectif_du','effectif_au','created_at','updated_at']);

export const EvenementCalendrierScalarFieldEnumSchema = z.enum(['id','etablissement_id','site_id','titre','debut','fin','type','description','created_at','updated_at']);

export const SessionAppelScalarFieldEnumSchema = z.enum(['id','classe_id','emploi_du_temps_id','date','creneau_horaire_id','pris_par_enseignant_id','pris_le','created_at','updated_at']);

export const PresenceEleveScalarFieldEnumSchema = z.enum(['id','session_appel_id','eleve_id','statut','minutes_retard','note','created_at','updated_at']);

export const MotifAbsenceScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','est_excuse_par_defaut','created_at','updated_at']);

export const JustificatifAbsenceScalarFieldEnumSchema = z.enum(['id','eleve_id','date_debut','date_fin','motif_absence_id','document_url','approuve_par','approuve_le','statut','created_at','updated_at']);

export const PresencePersonnelScalarFieldEnumSchema = z.enum(['id','personnel_id','date','statut','note','created_at','updated_at']);

export const IncidentDisciplinaireScalarFieldEnumSchema = z.enum(['id','eleve_id','date','signale_par','description','gravite','statut','created_at','updated_at']);

export const SanctionDisciplinaireScalarFieldEnumSchema = z.enum(['id','incident_id','type_action','debut','fin','notes','decide_par','created_at','updated_at']);

export const RecompenseScalarFieldEnumSchema = z.enum(['id','eleve_id','date','points','raison','donne_par','created_at','updated_at']);

export const CanalCommunicationScalarFieldEnumSchema = z.enum(['id','etablissement_id','type','nom','config_json','created_at','updated_at']);

export const AnnonceScalarFieldEnumSchema = z.enum(['id','etablissement_id','titre','contenu','publie_le','cree_par','cible_json','created_at','updated_at']);

export const MessageScalarFieldEnumSchema = z.enum(['id','etablissement_id','expediteur_utilisateur_id','objet','corps','envoye_le','created_at','updated_at']);

export const MessageDestinataireScalarFieldEnumSchema = z.enum(['message_id','utilisateur_id','statut','lu_le']);

export const NotificationScalarFieldEnumSchema = z.enum(['id','utilisateur_id','type','payload_json','lu_le','created_at','updated_at']);

export const CatalogueFraisScalarFieldEnumSchema = z.enum(['id','etablissement_id','niveau_scolaire_id','usage_scope','nom','description','montant','devise','nombre_tranches','mode_facturation','est_recurrent','periodicite','prorata_eligible','eligibilite_json','plans_paiement_autorises_json','plan_paiement_defaut_code','statut_validation','approuve_par_utilisateur_id','approuve_le','motif_rejet','created_at','updated_at']);

export const PlanPaiementEleveScalarFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','remise_id','plan_json','created_at','updated_at']);

export const FacturationRecurrenteExecutionScalarFieldEnumSchema = z.enum(['id','run_id','etablissement_id','catalogue_frais_id','eleve_id','annee_scolaire_id','facture_id','created_by_utilisateur_id','periodicite','cycle_key','cycle_label','date_reference','created_at','updated_at']);

export const FactureScalarFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','remise_id','facture_origine_id','nature','numero_facture','date_emission','date_echeance','statut','total_montant','devise','created_at','updated_at']);

export const FactureLigneScalarFieldEnumSchema = z.enum(['id','facture_id','catalogue_frais_id','libelle','quantite','prix_unitaire','montant','created_at','updated_at']);

export const PaiementScalarFieldEnumSchema = z.enum(['id','facture_id','paye_le','montant','statut','methode','numero_recu','reference','payeur_type','payeur_nom','payeur_reference','recu_par','created_at','updated_at']);

export const OperationFinanciereScalarFieldEnumSchema = z.enum(['id','etablissement_id','facture_id','paiement_id','abonnement_cantine_id','cree_par_utilisateur_id','type','montant','motif','details_json','created_at','updated_at']);

export const EcheancePaiementScalarFieldEnumSchema = z.enum(['id','plan_paiement_id','facture_id','eleve_id','annee_scolaire_id','ordre','libelle','date_echeance','montant_prevu','montant_regle','montant_restant','statut','devise','notes','created_at','updated_at']);

export const PaiementEcheanceAffectationScalarFieldEnumSchema = z.enum(['id','paiement_id','echeance_paiement_id','montant','created_at','updated_at']);

export const RemiseScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','type','valeur','regles_json','created_at','updated_at']);

export const RegleRecouvrementFinanceScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','jours_grace','relance_jours_json','penalite_active','penalite_mode','penalite_valeur','statut_validation','approuve_par_utilisateur_id','approuve_le','motif_rejet','created_at','updated_at']);

export const PromessePaiementScalarFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','echeance_paiement_id','montant_promis','date_promesse','date_limite','statut','canal','note','tenue_le','rompue_le','annulee_le','cree_par_utilisateur_id','valide_par_utilisateur_id','created_at','updated_at']);

export const RestrictionAdministrativeScalarFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','type','statut','source','motif','date_activation','date_levee','cree_par_utilisateur_id','levee_par_utilisateur_id','created_at','updated_at']);

export const DossierRecouvrementScalarFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','statut','motif','note','montant_reference','date_statut','cree_par_utilisateur_id','valide_par_utilisateur_id','valide_le','created_at','updated_at']);

export const RessourceBibliothequeScalarFieldEnumSchema = z.enum(['id','etablissement_id','type','titre','code','auteur','editeur','annee','stock','created_at','updated_at']);

export const EmpruntScalarFieldEnumSchema = z.enum(['id','ressource_bibliotheque_id','eleve_id','personnel_id','emprunte_le','du_le','retourne_le','statut','created_at','updated_at']);

export const LigneTransportScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','catalogue_frais_id','infos_vehicule_json','created_at','updated_at']);

export const ArretTransportScalarFieldEnumSchema = z.enum(['id','ligne_transport_id','nom','geo_json','ordre','created_at','updated_at']);

export const AbonnementTransportScalarFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','ligne_transport_id','arret_transport_id','zone_transport','facture_id','a_facturer','statut','date_debut_service','date_fin_service','prorata_ratio','created_at','updated_at']);

export const HistoriqueAffectationTransportScalarFieldEnumSchema = z.enum(['id','abonnement_transport_id','ancienne_ligne_transport_id','ancien_arret_transport_id','ancienne_zone_transport','nouvelle_ligne_transport_id','nouvel_arret_transport_id','nouvelle_zone_transport','date_effet','impact_tarifaire','ancien_statut','nouveau_statut','details_json','created_at','updated_at']);

export const FormuleCantineScalarFieldEnumSchema = z.enum(['id','etablissement_id','nom','type_formule','catalogue_frais_id','transmettre_consommations_finance','max_repas_par_jour','regulariser_absence_annulation','mode_regularisation_absence','created_at','updated_at']);

export const AbonnementCantineScalarFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','formule_cantine_id','facture_id','statut','date_effet','solde_prepaye','solde_min_alerte','dernier_rechargement_le','created_at','updated_at']);

export const HistoriqueFormuleCantineScalarFieldEnumSchema = z.enum(['id','abonnement_cantine_id','ancienne_formule_cantine_id','nouvelle_formule_cantine_id','date_effet','impact_tarifaire','ancien_statut','nouveau_statut','details_json','created_at','updated_at']);

export const ConsommationCantineScalarFieldEnumSchema = z.enum(['id','abonnement_cantine_id','type_repas','note','consommation_le','statut_acces','motif_acces','finance_status_snapshot','transmission_finance','finance_processed_at','details_json','created_at','updated_at']);

export const AbsenceCantineScalarFieldEnumSchema = z.enum(['id','abonnement_cantine_id','type_evenement','date_repas','etat_metier','note','statut_acces_snapshot','finance_status_snapshot','ouvre_droit_regularisation','mode_regularisation_suggere','transmission_finance','finance_processed_at','decision_finance','details_json','created_at','updated_at']);

export const FichierScalarFieldEnumSchema = z.enum(['id','etablissement_id','proprietaire_utilisateur_id','fournisseur_stockage','chemin','type_mime','taille','checksum','televerse_le','created_at','updated_at']);

export const LienFichierScalarFieldEnumSchema = z.enum(['id','fichier_id','type_entite','id_entite','tag','created_at','updated_at']);

export const DocumentTypeInscriptionScalarFieldEnumSchema = z.enum(['id','etablissement_id','code','nom','description','type_inscriptions_json','est_obligatoire_par_defaut','est_actif','ordre','created_at','updated_at']);

export const InscriptionDocumentScalarFieldEnumSchema = z.enum(['id','inscription_id','document_type_id','fichier_id','verifie_par_utilisateur_id','obligatoire','fourni','statut','date_depot','date_verification','commentaire_admin','created_at','updated_at']);

export const JournalAuditScalarFieldEnumSchema = z.enum(['id','etablissement_id','acteur_utilisateur_id','action','type_entite','id_entite','avant_json','apres_json','ip','date_action','created_at','updated_at']);

export const WebhookScalarFieldEnumSchema = z.enum(['id','etablissement_id','url','evenements_json','secret','est_actif','created_at','updated_at']);

export const JetonIntegrationScalarFieldEnumSchema = z.enum(['id','etablissement_id','fournisseur','token_json','expire_le','created_at','updated_at']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const NullsOrderSchema = z.enum(['first','last']);

export const EtablissementOrderByRelevanceFieldEnumSchema = z.enum(['id','nom','code','fuseau_horaire']);

export const SiteOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','adresse','telephone']);

export const AnneeScolaireOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const PeriodeOrderByRelevanceFieldEnumSchema = z.enum(['id','annee_scolaire_id','nom']);

export const SalleOrderByRelevanceFieldEnumSchema = z.enum(['id','site_id','nom','type']);

export const ReferencielOrderByRelevanceFieldEnumSchema = z.enum(['id','titre','code']);

export const EtablissementReferencielOrderByRelevanceFieldEnumSchema = z.enum(['id','referenciel_id','etablissement_id','valeur','referencielId']);

export const UtilisateurOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','email','telephone','mot_de_passe_hash']);

export const ProfilOrderByRelevanceFieldEnumSchema = z.enum(['id','utilisateur_id','prenom','nom','lieu_naissance','nationalite','genre','photo_url','adresse','telephone_personnel','email_personnel']);

export const RoleOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const PermissionOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','code','description']);

export const RolePermissionOrderByRelevanceFieldEnumSchema = z.enum(['role_id','permission_id']);

export const UtilisateurRoleOrderByRelevanceFieldEnumSchema = z.enum(['utilisateur_id','role_id']);

export const EleveOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','code_eleve','utilisateur_id','statut']);

export const EleveMedicalProfileOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','groupe_sanguin','allergies','maladies_particulieres','traitement_medical','medecin_traitant','telephone_medecin','personne_a_contacter_urgence','telephone_urgence']);

export const ParentTuteurOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','utilisateur_id','nom_complet','telephone','telephone_secondaire','email','adresse','profession','lieu_travail']);

export const EleveParentTuteurOrderByRelevanceFieldEnumSchema = z.enum(['eleve_id','parent_tuteur_id','relation']);

export const NiveauScolaireOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const ClasseOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','site_id','nom','enseignant_principal_id']);

export const InscriptionOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','niveau_scolaire_id','classe_id','annee_scolaire_id','raison_sortie']);

export const InscriptionSchoolHistoryOrderByRelevanceFieldEnumSchema = z.enum(['id','inscription_id','ancien_etablissement','ancienne_classe','annee_precedente','decision_precedente','mention_precedente','motif_transfert','observations']);

export const IdentifiantEleveOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','type','valeur']);

export const PersonnelOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','code_personnel','utilisateur_id','statut','poste']);

export const EnseignantOrderByRelevanceFieldEnumSchema = z.enum(['id','personnel_id','departement_principal_id']);

export const DepartementOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const MatiereOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','code','nom','departement_id']);

export const PedagogicalItemOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','parent_id','matiere_id','grading_scale_id','code','nom','description']);

export const GradingScaleOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','nom']);

export const GradingScaleLevelOrderByRelevanceFieldEnumSchema = z.enum(['id','grading_scale_id','code','label','color']);

export const ProgrammeOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','code','nom','description','default_grading_scale_id','created_by_utilisateur_id','updated_by_utilisateur_id']);

export const ProgrammeMatiereOrderByRelevanceFieldEnumSchema = z.enum(['id','programme_id','matiere_id','libelle_bulletin','grading_scale_id']);

export const ProgrammeChangeLogOrderByRelevanceFieldEnumSchema = z.enum(['id','programme_id','entity_type','entity_id','action','field_name','reason','changed_by_utilisateur_id']);

export const CoursOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','classe_id','matiere_id','enseignant_id']);

export const TypeEvaluationRefOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const EvaluationOrderByRelevanceFieldEnumSchema = z.enum(['id','cours_id','periode_id','pedagogical_item_id','grading_scale_id','type_evaluation_id','titre','description','cree_par_enseignant_id']);

export const NoteOrderByRelevanceFieldEnumSchema = z.enum(['id','evaluation_id','eleve_id','commentaire','note_par']);

export const AssessmentResultOrderByRelevanceFieldEnumSchema = z.enum(['id','assessment_id','student_id','scale_level_id','text_value','display_value','observation','validated_by']);

export const AssessmentResultHistoryOrderByRelevanceFieldEnumSchema = z.enum(['id','assessment_result_id','old_scale_level_id','new_scale_level_id','old_text_value','new_text_value','old_display_value','new_display_value','reason','changed_by']);

export const PedagogicalItemAverageOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','periode_id','classe_id','eleve_id','pedagogical_item_id','display_value','status']);

export const RegleNoteOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','scope']);

export const ReportCardTemplateOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','annee_scolaire_id','niveau_scolaire_id','nom','description','non_evaluated_label']);

export const ReportCardTemplatePedagogicalItemOrderByRelevanceFieldEnumSchema = z.enum(['id','template_id','section_id','pedagogical_item_id','custom_label','grading_scale_id_override']);

export const ReportCardTemplateSectionOrderByRelevanceFieldEnumSchema = z.enum(['id','template_id','parent_section_id','title']);

export const ReportCardTemplateFieldOrderByRelevanceFieldEnumSchema = z.enum(['id','template_id','section_id','field_key','label','alignment']);

export const BulletinOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','periode_id','classe_id','report_card_template_id','validated_by','statut','mention','decision','general_appreciation']);

export const BulletinLigneOrderByRelevanceFieldEnumSchema = z.enum(['id','bulletin_id','matiere_id','parent_ligne_id','pedagogical_item_id','display_value','scale_level_id','observation','commentaire_enseignant']);

export const BulletinLigneDetailOrderByRelevanceFieldEnumSchema = z.enum(['id','bulletin_ligne_id','assessment_id','assessment_result_id','label','display_value','scale_level_id']);

export const BulletinCodeLegendOrderByRelevanceFieldEnumSchema = z.enum(['id','bulletin_id','grading_scale_id','code','label']);

export const CreneauHoraireOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','heure_debut','heure_fin']);

export const EmploiDuTempsOrderByRelevanceFieldEnumSchema = z.enum(['id','classe_id','cours_id','matiere_id','enseignant_id','salle_id','heure_debut','heure_fin','creneau_horaire_id']);

export const EvenementCalendrierOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','site_id','titre','type','description']);

export const SessionAppelOrderByRelevanceFieldEnumSchema = z.enum(['id','classe_id','emploi_du_temps_id','creneau_horaire_id','pris_par_enseignant_id']);

export const PresenceEleveOrderByRelevanceFieldEnumSchema = z.enum(['id','session_appel_id','eleve_id','note']);

export const MotifAbsenceOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const JustificatifAbsenceOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','motif_absence_id','document_url','approuve_par','statut']);

export const PresencePersonnelOrderByRelevanceFieldEnumSchema = z.enum(['id','personnel_id','statut','note']);

export const IncidentDisciplinaireOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','signale_par','description','statut']);

export const SanctionDisciplinaireOrderByRelevanceFieldEnumSchema = z.enum(['id','incident_id','type_action','notes','decide_par']);

export const RecompenseOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','raison','donne_par']);

export const CanalCommunicationOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom']);

export const AnnonceOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','titre','contenu','cree_par']);

export const MessageOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','expediteur_utilisateur_id','objet','corps']);

export const MessageDestinataireOrderByRelevanceFieldEnumSchema = z.enum(['message_id','utilisateur_id','statut']);

export const NotificationOrderByRelevanceFieldEnumSchema = z.enum(['id','utilisateur_id','type']);

export const CatalogueFraisOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','niveau_scolaire_id','usage_scope','nom','description','devise','mode_facturation','periodicite','plan_paiement_defaut_code','statut_validation','approuve_par_utilisateur_id','motif_rejet']);

export const PlanPaiementEleveOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','remise_id']);

export const FacturationRecurrenteExecutionOrderByRelevanceFieldEnumSchema = z.enum(['id','run_id','etablissement_id','catalogue_frais_id','eleve_id','annee_scolaire_id','facture_id','created_by_utilisateur_id','periodicite','cycle_key','cycle_label']);

export const FactureOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','remise_id','facture_origine_id','nature','numero_facture','devise']);

export const FactureLigneOrderByRelevanceFieldEnumSchema = z.enum(['id','facture_id','catalogue_frais_id','libelle']);

export const PaiementOrderByRelevanceFieldEnumSchema = z.enum(['id','facture_id','statut','methode','numero_recu','reference','payeur_type','payeur_nom','payeur_reference','recu_par']);

export const OperationFinanciereOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','facture_id','paiement_id','abonnement_cantine_id','cree_par_utilisateur_id','type','motif']);

export const EcheancePaiementOrderByRelevanceFieldEnumSchema = z.enum(['id','plan_paiement_id','facture_id','eleve_id','annee_scolaire_id','libelle','devise','notes']);

export const PaiementEcheanceAffectationOrderByRelevanceFieldEnumSchema = z.enum(['id','paiement_id','echeance_paiement_id']);

export const RemiseOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','type']);

export const RegleRecouvrementFinanceOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','penalite_mode','statut_validation','approuve_par_utilisateur_id','motif_rejet']);

export const PromessePaiementOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','echeance_paiement_id','canal','note','cree_par_utilisateur_id','valide_par_utilisateur_id']);

export const RestrictionAdministrativeOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','source','motif','cree_par_utilisateur_id','levee_par_utilisateur_id']);

export const DossierRecouvrementOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','eleve_id','annee_scolaire_id','facture_id','plan_paiement_id','motif','note','cree_par_utilisateur_id','valide_par_utilisateur_id']);

export const RessourceBibliothequeOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','type','titre','code','auteur','editeur']);

export const EmpruntOrderByRelevanceFieldEnumSchema = z.enum(['id','ressource_bibliotheque_id','eleve_id','personnel_id','statut']);

export const LigneTransportOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','catalogue_frais_id']);

export const ArretTransportOrderByRelevanceFieldEnumSchema = z.enum(['id','ligne_transport_id','nom']);

export const AbonnementTransportOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','ligne_transport_id','arret_transport_id','zone_transport','facture_id','statut']);

export const HistoriqueAffectationTransportOrderByRelevanceFieldEnumSchema = z.enum(['id','abonnement_transport_id','ancienne_ligne_transport_id','ancien_arret_transport_id','ancienne_zone_transport','nouvelle_ligne_transport_id','nouvel_arret_transport_id','nouvelle_zone_transport','ancien_statut','nouveau_statut']);

export const FormuleCantineOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','nom','type_formule','catalogue_frais_id','mode_regularisation_absence']);

export const AbonnementCantineOrderByRelevanceFieldEnumSchema = z.enum(['id','eleve_id','annee_scolaire_id','formule_cantine_id','facture_id','statut']);

export const HistoriqueFormuleCantineOrderByRelevanceFieldEnumSchema = z.enum(['id','abonnement_cantine_id','ancienne_formule_cantine_id','nouvelle_formule_cantine_id','ancien_statut','nouveau_statut']);

export const ConsommationCantineOrderByRelevanceFieldEnumSchema = z.enum(['id','abonnement_cantine_id','type_repas','note','statut_acces','motif_acces','finance_status_snapshot']);

export const AbsenceCantineOrderByRelevanceFieldEnumSchema = z.enum(['id','abonnement_cantine_id','type_evenement','etat_metier','note','statut_acces_snapshot','finance_status_snapshot','mode_regularisation_suggere','decision_finance']);

export const FichierOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','proprietaire_utilisateur_id','fournisseur_stockage','chemin','type_mime','checksum']);

export const LienFichierOrderByRelevanceFieldEnumSchema = z.enum(['id','fichier_id','type_entite','id_entite','tag']);

export const DocumentTypeInscriptionOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','code','nom','description']);

export const InscriptionDocumentOrderByRelevanceFieldEnumSchema = z.enum(['id','inscription_id','document_type_id','fichier_id','verifie_par_utilisateur_id','commentaire_admin']);

export const JournalAuditOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','acteur_utilisateur_id','action','type_entite','id_entite','ip']);

export const WebhookOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','url','secret']);

export const JetonIntegrationOrderByRelevanceFieldEnumSchema = z.enum(['id','etablissement_id','fournisseur']);

export const StatutCompteSchema = z.enum(['ACTIF','INACTIF','SUSPENDU']);

export const StatutInscriptionSchema = z.enum(['PREINSCRIT','INSCRIT','EN_ATTENTE_PAIEMENT','VALIDEE','DOSSIER_INCOMPLET','ANNULEE','TRANSFERE','SUSPENDUE','SORTI']);

export const TypeInscriptionSchema = z.enum(['NOUVELLE_INSCRIPTION','REINSCRIPTION','TRANSFERT_ENTRANT','REDOUBLEMENT','PASSAGE_CLASSE_SUPERIEURE']);

export const StatutAdministratifInscriptionSchema = z.enum(['EN_ATTENTE','DOSSIER_INCOMPLET','EN_ATTENTE_VERIFICATION','VALIDE','REJETE','ANNULE']);

export const StatutFinancierInscriptionSchema = z.enum(['NON_FACTURE','FACTURE','NON_PAYE','PARTIELLEMENT_PAYE','PAYE','EN_RETARD','EXONERE','ANNULE']);

export const StatutDossierInscriptionSchema = z.enum(['COMPLET','INCOMPLET','EN_ATTENTE_VERIFICATION','VALIDE','REJETE']);

export const StatutDocumentInscriptionSchema = z.enum(['NON_FOURNI','FOURNI','EN_ATTENTE_VERIFICATION','VALIDE','REJETE','EXPIRE']);

export const StatutPresenceSchema = z.enum(['PRESENT','ABSENT','RETARD','EXCUSE']);

export const StatutFactureSchema = z.enum(['BROUILLON','EMISE','PARTIELLE','PAYEE','ANNULEE','EN_RETARD']);

export const StatutEcheancePaiementSchema = z.enum(['A_VENIR','PARTIELLE','PAYEE','ANNULEE','EN_RETARD']);

export const StatutPromessePaiementSchema = z.enum(['EN_ATTENTE','TENUE','ROMPUE','ANNULEE']);

export const TypeRestrictionAdministrativeSchema = z.enum(['BULLETIN','EXAMEN','REINSCRIPTION']);

export const StatutRestrictionAdministrativeSchema = z.enum(['ACTIVE','LEVEE','ANNULEE']);

export const StatutDossierRecouvrementSchema = z.enum(['OUVERT','RENFORCE','CONTENTIEUX','IRRECOUVRABLE','ABANDON_EN_ATTENTE','ABANDONNE','CLOTURE']);

export const TypeCanalSchema = z.enum(['EMAIL','SMS','APP']);

export const TypeEvaluationSchema = z.enum(['DEVOIR','EXAMEN','ORAL','AUTRE']);

export const ReportCardTemplateTypeSchema = z.enum(['STANDARD','DETAILED','ASSESSMENT_TYPE_SUMMARY','FINAL_EXAM_ONLY','CUSTOM']);

export const PedagogicalDisplayModeSchema = z.enum(['SUBJECTS_ONLY','SUBJECTS_AND_DOMAINS','FULL_HIERARCHY','COMPETENCIES_ONLY','CUSTOM']);

export const PedagogicalItemTypeSchema = z.enum(['SUBJECT','GROUP','DOMAIN','SUBDOMAIN','COMPETENCY','OBJECTIVE']);

export const PedagogicalCalculationModeSchema = z.enum(['NONE','SIMPLE_AVERAGE','WEIGHTED_AVERAGE','SUM','MANUAL']);

export const StatutProgrammeSchema = z.enum(['DRAFT','ACTIVE','IN_REVISION','LOCKED','ARCHIVED']);

export const StatutProgrammeMatiereSchema = z.enum(['ACTIVE','INACTIVE','DISABLED']);

export const GradingTypeSchema = z.enum(['POINTS','LETTER','LEVEL','DESCRIPTIVE','PERCENTAGE','VALIDATION']);

export const AssessmentWorkflowStatusSchema = z.enum(['DRAFT','PUBLISHED','RESULTS_ENTERED','VALIDATED','LOCKED','ARCHIVED']);

export const AssessmentResultStatusSchema = z.enum(['GRADED','JUSTIFIED_ABSENCE','UNJUSTIFIED_ABSENCE','EXEMPTED','NOT_SUBMITTED','NOT_EVALUATED']);

export const ReportAverageCalculationModeSchema = z.enum(['SIMPLE','HIERARCHICAL','WEIGHTED','COEFFICIENT_BASED']);

export const BulletinGradingModeSchema = z.enum(['NUMERIC','CODE','LEVEL','DESCRIPTIVE','MIXED','NONE']);

export const ReportCardTemplateSectionTypeSchema = z.enum(['ACADEMIC_NUMERIC','ACADEMIC_CODE','BEHAVIOR','GENERAL_APPRECIATION','DECISION','CODE_LEGEND','CUSTOM']);

export const EtablissementSchema = z.object({
  id: z.uuid(),
  nom: z.string(),
  code: z.string().nullable(),
  fuseau_horaire: z.string().nullable(),
  parametres_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Etablissement = z.infer<typeof EtablissementSchema>

export const SiteSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  adresse: z.string().nullable(),
  telephone: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Site = z.infer<typeof SiteSchema>

export const AnneeScolaireSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  date_debut: z.coerce.date(),
  date_fin: z.coerce.date(),
  est_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type AnneeScolaire = z.infer<typeof AnneeScolaireSchema>

export const PeriodeSchema = z.object({
  id: z.uuid(),
  annee_scolaire_id: z.string(),
  nom: z.string(),
  date_debut: z.coerce.date(),
  date_fin: z.coerce.date(),
  ordre: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Periode = z.infer<typeof PeriodeSchema>

export const SalleSchema = z.object({
  id: z.uuid(),
  site_id: z.string(),
  nom: z.string(),
  capacite: z.number().int().nullable(),
  type: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Salle = z.infer<typeof SalleSchema>

export const ReferencielSchema = z.object({
  id: z.uuid(),
  titre: z.string(),
  code: z.string(),
})

export type Referenciel = z.infer<typeof ReferencielSchema>

export const EtablissementReferencielSchema = z.object({
  id: z.uuid(),
  referenciel_id: z.string(),
  etablissement_id: z.string(),
  valeur: z.string(),
  referencielId: z.string().nullable(),
})

export type EtablissementReferenciel = z.infer<typeof EtablissementReferencielSchema>

export const UtilisateurSchema = z.object({
  statut: StatutCompteSchema,
  id: z.uuid(),
  etablissement_id: z.string().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  mot_de_passe_hash: z.string().nullable(),
  dernier_login: z.coerce.date().nullable(),
  scope_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Utilisateur = z.infer<typeof UtilisateurSchema>

export const ProfilSchema = z.object({
  id: z.uuid(),
  utilisateur_id: z.string(),
  prenom: z.string(),
  nom: z.string(),
  date_naissance: z.coerce.date().nullable(),
  lieu_naissance: z.string().nullable(),
  nationalite: z.string().nullable(),
  genre: z.string().nullable(),
  photo_url: z.string().nullable(),
  adresse: z.string().nullable(),
  telephone_personnel: z.string().nullable(),
  email_personnel: z.string().nullable(),
  contact_urgence_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Profil = z.infer<typeof ProfilSchema>

export const RoleSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string().nullable(),
  nom: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  scope_json: JsonValueSchema.nullable(),
})

export type Role = z.infer<typeof RoleSchema>

export const PermissionSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string().nullable(),
  code: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Permission = z.infer<typeof PermissionSchema>

export const RolePermissionSchema = z.object({
  role_id: z.string(),
  permission_id: z.string(),
})

export type RolePermission = z.infer<typeof RolePermissionSchema>

export const UtilisateurRoleSchema = z.object({
  utilisateur_id: z.string(),
  role_id: z.string(),
  scope_json: JsonValueSchema.nullable(),
})

export type UtilisateurRole = z.infer<typeof UtilisateurRoleSchema>

export const EleveSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  code_eleve: z.string().nullable(),
  utilisateur_id: z.string().nullable(),
  statut: z.string().nullable(),
  date_entree: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Eleve = z.infer<typeof EleveSchema>

export const EleveMedicalProfileSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  groupe_sanguin: z.string().nullable(),
  allergies: z.string().nullable(),
  maladies_particulieres: z.string().nullable(),
  traitement_medical: z.string().nullable(),
  medecin_traitant: z.string().nullable(),
  telephone_medecin: z.string().nullable(),
  autorisation_prise_en_charge_medicale: z.boolean(),
  personne_a_contacter_urgence: z.string().nullable(),
  telephone_urgence: z.string().nullable(),
  notes_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type EleveMedicalProfile = z.infer<typeof EleveMedicalProfileSchema>

export const ParentTuteurSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  utilisateur_id: z.string().nullable(),
  nom_complet: z.string(),
  telephone: z.string().nullable(),
  telephone_secondaire: z.string().nullable(),
  email: z.string().nullable(),
  adresse: z.string().nullable(),
  profession: z.string().nullable(),
  lieu_travail: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ParentTuteur = z.infer<typeof ParentTuteurSchema>

export const EleveParentTuteurSchema = z.object({
  eleve_id: z.string(),
  parent_tuteur_id: z.string(),
  relation: z.string().nullable(),
  est_principal: z.boolean(),
  est_responsable_legal: z.boolean(),
  est_responsable_financier: z.boolean(),
  est_contact_urgence: z.boolean(),
  autorise_recuperation: z.boolean(),
})

export type EleveParentTuteur = z.infer<typeof EleveParentTuteurSchema>

export const NiveauScolaireSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  ordre: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type NiveauScolaire = z.infer<typeof NiveauScolaireSchema>

export const ClasseSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  niveau_scolaire_id: z.string(),
  site_id: z.string().nullable(),
  nom: z.string(),
  capacite: z.number().int().nullable(),
  enseignant_principal_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Classe = z.infer<typeof ClasseSchema>

export const InscriptionSchema = z.object({
  type_inscription: TypeInscriptionSchema,
  statut: StatutInscriptionSchema,
  statut_administratif: StatutAdministratifInscriptionSchema,
  statut_financier: StatutFinancierInscriptionSchema,
  statut_dossier: StatutDossierInscriptionSchema,
  id: z.uuid(),
  eleve_id: z.string(),
  niveau_scolaire_id: z.string().nullable(),
  classe_id: z.string().nullable(),
  annee_scolaire_id: z.string(),
  date_inscription: z.coerce.date(),
  validation_date: z.coerce.date().nullable(),
  completion_rate: DecimalValueSchema.nullable(),
  acces_systeme_json: JsonValueSchema.nullable(),
  consentements_json: JsonValueSchema.nullable(),
  observations_json: JsonValueSchema.nullable(),
  date_sortie: z.coerce.date().nullable(),
  raison_sortie: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Inscription = z.infer<typeof InscriptionSchema>

export const InscriptionSchoolHistorySchema = z.object({
  id: z.uuid(),
  inscription_id: z.string(),
  ancien_etablissement: z.string().nullable(),
  ancienne_classe: z.string().nullable(),
  annee_precedente: z.string().nullable(),
  derniere_moyenne: DecimalValueSchema.nullable(),
  decision_precedente: z.string().nullable(),
  mention_precedente: z.string().nullable(),
  motif_transfert: z.string().nullable(),
  observations: z.string().nullable(),
  reprise_auto: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type InscriptionSchoolHistory = z.infer<typeof InscriptionSchoolHistorySchema>

export const IdentifiantEleveSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  type: z.string(),
  valeur: z.string(),
  delivre_le: z.coerce.date().nullable(),
  expire_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type IdentifiantEleve = z.infer<typeof IdentifiantEleveSchema>

export const PersonnelSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  code_personnel: z.string().nullable(),
  utilisateur_id: z.string().nullable(),
  date_embauche: z.coerce.date().nullable(),
  statut: z.string().nullable(),
  poste: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Personnel = z.infer<typeof PersonnelSchema>

export const EnseignantSchema = z.object({
  id: z.uuid(),
  personnel_id: z.string(),
  departement_principal_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Enseignant = z.infer<typeof EnseignantSchema>

export const DepartementSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Departement = z.infer<typeof DepartementSchema>

export const MatiereSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  code: z.string().nullable(),
  nom: z.string(),
  departement_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Matiere = z.infer<typeof MatiereSchema>

export const PedagogicalItemSchema = z.object({
  item_type: PedagogicalItemTypeSchema,
  grading_mode_override: BulletinGradingModeSchema.nullable(),
  calculation_mode: PedagogicalCalculationModeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  niveau_scolaire_id: z.string(),
  parent_id: z.string().nullable(),
  matiere_id: z.string().nullable(),
  grading_scale_id: z.string().nullable(),
  code: z.string().nullable(),
  nom: z.string(),
  description: z.string().nullable(),
  display_order: z.number().int(),
  coefficient: z.number().nullable(),
  weight: z.number().nullable(),
  is_evaluable: z.boolean(),
  is_visible_on_report: z.boolean(),
  is_required: z.boolean(),
  include_in_general_average: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PedagogicalItem = z.infer<typeof PedagogicalItemSchema>

export const GradingScaleSchema = z.object({
  grading_type: GradingTypeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  nom: z.string(),
  base_score: z.number().nullable(),
  use_for_calculation: z.boolean(),
  allow_decimal: z.boolean(),
  is_default: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type GradingScale = z.infer<typeof GradingScaleSchema>

export const GradingScaleLevelSchema = z.object({
  id: z.uuid(),
  grading_scale_id: z.string(),
  code: z.string(),
  label: z.string(),
  numeric_value: z.number().nullable(),
  min_value: z.number().nullable(),
  max_value: z.number().nullable(),
  display_order: z.number().int(),
  color: z.string().nullable(),
  is_success_level: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type GradingScaleLevel = z.infer<typeof GradingScaleLevelSchema>

export const ProgrammeSchema = z.object({
  statut: StatutProgrammeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  niveau_scolaire_id: z.string(),
  code: z.string().nullable(),
  nom: z.string(),
  description: z.string().nullable(),
  date_debut: z.coerce.date().nullable(),
  date_fin: z.coerce.date().nullable(),
  est_actif: z.boolean(),
  ordre_affichage: z.number().int(),
  default_grading_scale_id: z.string().nullable(),
  verrouille_le: z.coerce.date().nullable(),
  archive_le: z.coerce.date().nullable(),
  created_by_utilisateur_id: z.string().nullable(),
  updated_by_utilisateur_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Programme = z.infer<typeof ProgrammeSchema>

export const ProgrammeMatiereSchema = z.object({
  mode_calcul: PedagogicalCalculationModeSchema,
  statut: StatutProgrammeMatiereSchema,
  id: z.uuid(),
  programme_id: z.string(),
  matiere_id: z.string(),
  heures_semaine: z.number().int().nullable(),
  heures_annuelles: z.number().int().nullable(),
  seances_par_semaine: z.number().int().nullable(),
  duree_seance_par_defaut: z.number().int().nullable(),
  coefficient: z.number().nullable(),
  est_obligatoire: z.boolean(),
  est_visible_bulletin: z.boolean(),
  inclure_moyenne_generale: z.boolean(),
  appreciation_obligatoire: z.boolean(),
  libelle_bulletin: z.string().nullable(),
  ordre_affichage_bulletin: z.number().int().nullable(),
  grading_scale_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ProgrammeMatiere = z.infer<typeof ProgrammeMatiereSchema>

export const ProgrammeChangeLogSchema = z.object({
  id: z.uuid(),
  programme_id: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  action: z.string(),
  field_name: z.string().nullable(),
  old_value_json: JsonValueSchema.nullable(),
  new_value_json: JsonValueSchema.nullable(),
  reason: z.string().nullable(),
  impact_summary_json: JsonValueSchema.nullable(),
  changed_by_utilisateur_id: z.string().nullable(),
  changed_at: z.coerce.date(),
})

export type ProgrammeChangeLog = z.infer<typeof ProgrammeChangeLogSchema>

export const CoursSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  classe_id: z.string(),
  matiere_id: z.string(),
  enseignant_id: z.string(),
  coefficient_override: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Cours = z.infer<typeof CoursSchema>

export const TypeEvaluationRefSchema = z.object({
  code: TypeEvaluationSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  poids_defaut: z.number().nullable(),
  default_max_score: z.number().nullable(),
  include_in_average: z.boolean(),
  show_in_report_card: z.boolean(),
  is_final_exam: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type TypeEvaluationRef = z.infer<typeof TypeEvaluationRefSchema>

export const EvaluationSchema = z.object({
  type: TypeEvaluationSchema,
  status: AssessmentWorkflowStatusSchema,
  id: z.uuid(),
  cours_id: z.string(),
  periode_id: z.string(),
  pedagogical_item_id: z.string().nullable(),
  grading_scale_id: z.string().nullable(),
  type_evaluation_id: z.string().nullable(),
  titre: z.string(),
  description: z.string().nullable(),
  date: z.coerce.date(),
  note_max: z.number(),
  poids: z.number().nullable(),
  est_publiee: z.boolean(),
  include_in_average: z.boolean(),
  show_in_report_card: z.boolean(),
  is_final_exam: z.boolean(),
  cree_par_enseignant_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Evaluation = z.infer<typeof EvaluationSchema>

export const NoteSchema = z.object({
  id: z.uuid(),
  evaluation_id: z.string(),
  eleve_id: z.string(),
  score: z.number(),
  commentaire: z.string().nullable(),
  note_le: z.coerce.date().nullable(),
  note_par: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Note = z.infer<typeof NoteSchema>

export const AssessmentResultSchema = z.object({
  status: AssessmentResultStatusSchema,
  id: z.uuid(),
  assessment_id: z.string(),
  student_id: z.string(),
  raw_score: z.number().nullable(),
  max_score: z.number().nullable(),
  normalized_score: z.number().nullable(),
  scale_level_id: z.string().nullable(),
  text_value: z.string().nullable(),
  display_value: z.string().nullable(),
  observation: z.string().nullable(),
  is_validated: z.boolean(),
  validated_at: z.coerce.date().nullable(),
  validated_by: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type AssessmentResult = z.infer<typeof AssessmentResultSchema>

export const AssessmentResultHistorySchema = z.object({
  old_status: AssessmentResultStatusSchema.nullable(),
  new_status: AssessmentResultStatusSchema.nullable(),
  id: z.uuid(),
  assessment_result_id: z.string(),
  old_raw_score: z.number().nullable(),
  new_raw_score: z.number().nullable(),
  old_max_score: z.number().nullable(),
  new_max_score: z.number().nullable(),
  old_normalized_score: z.number().nullable(),
  new_normalized_score: z.number().nullable(),
  old_scale_level_id: z.string().nullable(),
  new_scale_level_id: z.string().nullable(),
  old_text_value: z.string().nullable(),
  new_text_value: z.string().nullable(),
  old_display_value: z.string().nullable(),
  new_display_value: z.string().nullable(),
  reason: z.string().nullable(),
  changed_by: z.string().nullable(),
  changed_at: z.coerce.date(),
})

export type AssessmentResultHistory = z.infer<typeof AssessmentResultHistorySchema>

export const PedagogicalItemAverageSchema = z.object({
  calculation_mode: ReportAverageCalculationModeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  periode_id: z.string(),
  classe_id: z.string(),
  eleve_id: z.string(),
  pedagogical_item_id: z.string(),
  student_average: z.number().nullable(),
  class_average: z.number().nullable(),
  display_value: z.string().nullable(),
  rounding_precision: z.number().int(),
  status: z.string().nullable(),
  calculated_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PedagogicalItemAverage = z.infer<typeof PedagogicalItemAverageSchema>

export const RegleNoteSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  scope: z.string().nullable(),
  regle_json: JsonValueSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type RegleNote = z.infer<typeof RegleNoteSchema>

export const ReportCardTemplateSchema = z.object({
  template_type: ReportCardTemplateTypeSchema,
  pedagogical_display_mode: PedagogicalDisplayModeSchema,
  calculation_mode: ReportAverageCalculationModeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  annee_scolaire_id: z.string(),
  niveau_scolaire_id: z.string().nullable(),
  nom: z.string(),
  description: z.string().nullable(),
  include_code_grades_in_general_average: z.boolean(),
  show_student_average: z.boolean(),
  show_class_average: z.boolean(),
  show_general_student_average: z.boolean(),
  show_general_class_average: z.boolean(),
  show_code_legend: z.boolean(),
  show_section_headers: z.boolean(),
  rounding_precision: z.number().int(),
  base_score: z.number().nullable(),
  exclude_non_evaluated_items: z.boolean(),
  minimum_required_results: z.number().int(),
  use_weights: z.boolean(),
  use_coefficients: z.boolean(),
  show_assessment_details: z.boolean(),
  show_assessment_type_summary: z.boolean(),
  show_only_final_exam: z.boolean(),
  show_subjects: z.boolean(),
  show_groups: z.boolean(),
  show_domains: z.boolean(),
  show_subdomains: z.boolean(),
  show_competencies: z.boolean(),
  show_objectives: z.boolean(),
  show_only_evaluated_items: z.boolean(),
  show_non_evaluated_items: z.boolean(),
  non_evaluated_label: z.string(),
  group_items_by_parent: z.boolean(),
  show_hierarchical_indent: z.boolean(),
  max_hierarchy_depth: z.number().int(),
  show_subject_summary: z.boolean(),
  show_domain_summary: z.boolean(),
  show_subdomain_summary: z.boolean(),
  show_competency_results: z.boolean(),
  show_subject_average: z.boolean(),
  show_subject_coefficient: z.boolean(),
  show_subject_points: z.boolean(),
  show_subject_rank: z.boolean(),
  show_teacher_appreciation: z.boolean(),
  show_general_average: z.boolean(),
  show_total_coefficients: z.boolean(),
  show_total_points: z.boolean(),
  show_general_rank: z.boolean(),
  show_mention: z.boolean(),
  show_decision: z.boolean(),
  show_general_appreciation: z.boolean(),
  show_absences: z.boolean(),
  show_late_count: z.boolean(),
  show_logo: z.boolean(),
  show_signature: z.boolean(),
  is_default: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ReportCardTemplate = z.infer<typeof ReportCardTemplateSchema>

export const ReportCardTemplatePedagogicalItemSchema = z.object({
  id: z.uuid(),
  template_id: z.string(),
  section_id: z.string().nullable(),
  pedagogical_item_id: z.string(),
  is_visible: z.boolean(),
  custom_label: z.string().nullable(),
  display_order: z.number().int(),
  show_result: z.boolean(),
  show_appreciation: z.boolean(),
  show_children: z.boolean(),
  grading_scale_id_override: z.string().nullable(),
  include_in_general_average_override: z.boolean().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ReportCardTemplatePedagogicalItem = z.infer<typeof ReportCardTemplatePedagogicalItemSchema>

export const ReportCardTemplateSectionSchema = z.object({
  section_type: ReportCardTemplateSectionTypeSchema,
  grading_mode: BulletinGradingModeSchema.nullable(),
  id: z.uuid(),
  template_id: z.string(),
  parent_section_id: z.string().nullable(),
  title: z.string(),
  display_order: z.number().int(),
  show_header: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ReportCardTemplateSection = z.infer<typeof ReportCardTemplateSectionSchema>

export const ReportCardTemplateFieldSchema = z.object({
  id: z.uuid(),
  template_id: z.string(),
  section_id: z.string(),
  field_key: z.string(),
  label: z.string(),
  display_order: z.number().int(),
  is_visible: z.boolean(),
  width: z.number().int().nullable(),
  alignment: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ReportCardTemplateField = z.infer<typeof ReportCardTemplateFieldSchema>

export const BulletinSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  periode_id: z.string(),
  classe_id: z.string(),
  report_card_template_id: z.string().nullable(),
  validated_at: z.coerce.date().nullable(),
  validated_by: z.string().nullable(),
  publie_le: z.coerce.date().nullable(),
  statut: z.string().nullable(),
  general_average: DecimalValueSchema.nullable(),
  general_class_average: DecimalValueSchema.nullable(),
  total_coefficients: DecimalValueSchema.nullable(),
  total_points: DecimalValueSchema.nullable(),
  general_rank: z.number().int().nullable(),
  mention: z.string().nullable(),
  decision: z.string().nullable(),
  general_appreciation: z.string().nullable(),
  display_snapshot_json: JsonValueSchema.nullable(),
  display_legend_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Bulletin = z.infer<typeof BulletinSchema>

export const BulletinLigneSchema = z.object({
  item_type: PedagogicalItemTypeSchema.nullable(),
  grading_mode: BulletinGradingModeSchema.nullable(),
  id: z.uuid(),
  bulletin_id: z.string(),
  matiere_id: z.string(),
  parent_ligne_id: z.string().nullable(),
  pedagogical_item_id: z.string().nullable(),
  moyenne: z.number().nullable(),
  display_value: z.string().nullable(),
  numeric_value: z.number().nullable(),
  student_average: z.number().nullable(),
  class_average: z.number().nullable(),
  scale_level_id: z.string().nullable(),
  observation: z.string().nullable(),
  rang: z.number().int().nullable(),
  commentaire_enseignant: z.string().nullable(),
  display_order: z.number().int(),
  is_visible: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type BulletinLigne = z.infer<typeof BulletinLigneSchema>

export const BulletinLigneDetailSchema = z.object({
  id: z.uuid(),
  bulletin_ligne_id: z.string(),
  assessment_id: z.string().nullable(),
  assessment_result_id: z.string().nullable(),
  label: z.string(),
  display_value: z.string().nullable(),
  numeric_value: z.number().nullable(),
  scale_level_id: z.string().nullable(),
  display_order: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type BulletinLigneDetail = z.infer<typeof BulletinLigneDetailSchema>

export const BulletinCodeLegendSchema = z.object({
  id: z.uuid(),
  bulletin_id: z.string(),
  grading_scale_id: z.string().nullable(),
  code: z.string(),
  label: z.string(),
  numeric_value: z.number().nullable(),
  display_order: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type BulletinCodeLegend = z.infer<typeof BulletinCodeLegendSchema>

export const CreneauHoraireSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  heure_debut: z.string(),
  heure_fin: z.string(),
  ordre: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type CreneauHoraire = z.infer<typeof CreneauHoraireSchema>

export const EmploiDuTempsSchema = z.object({
  id: z.uuid(),
  classe_id: z.string(),
  cours_id: z.string().nullable(),
  matiere_id: z.string().nullable(),
  enseignant_id: z.string().nullable(),
  salle_id: z.string().nullable(),
  jour_semaine: z.number().int(),
  heure_debut: z.string(),
  heure_fin: z.string(),
  creneau_horaire_id: z.string().nullable(),
  effectif_du: z.coerce.date().nullable(),
  effectif_au: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type EmploiDuTemps = z.infer<typeof EmploiDuTempsSchema>

export const EvenementCalendrierSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  site_id: z.string().nullable(),
  titre: z.string(),
  debut: z.coerce.date(),
  fin: z.coerce.date(),
  type: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type EvenementCalendrier = z.infer<typeof EvenementCalendrierSchema>

export const SessionAppelSchema = z.object({
  id: z.uuid(),
  classe_id: z.string(),
  emploi_du_temps_id: z.string().nullable(),
  date: z.coerce.date(),
  creneau_horaire_id: z.string(),
  pris_par_enseignant_id: z.string().nullable(),
  pris_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type SessionAppel = z.infer<typeof SessionAppelSchema>

export const PresenceEleveSchema = z.object({
  statut: StatutPresenceSchema,
  id: z.uuid(),
  session_appel_id: z.string(),
  eleve_id: z.string(),
  minutes_retard: z.number().int().nullable(),
  note: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PresenceEleve = z.infer<typeof PresenceEleveSchema>

export const MotifAbsenceSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  est_excuse_par_defaut: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type MotifAbsence = z.infer<typeof MotifAbsenceSchema>

export const JustificatifAbsenceSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  date_debut: z.coerce.date(),
  date_fin: z.coerce.date(),
  motif_absence_id: z.string().nullable(),
  document_url: z.string().nullable(),
  approuve_par: z.string().nullable(),
  approuve_le: z.coerce.date().nullable(),
  statut: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type JustificatifAbsence = z.infer<typeof JustificatifAbsenceSchema>

export const PresencePersonnelSchema = z.object({
  id: z.uuid(),
  personnel_id: z.string(),
  date: z.coerce.date(),
  statut: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PresencePersonnel = z.infer<typeof PresencePersonnelSchema>

export const IncidentDisciplinaireSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  date: z.coerce.date(),
  signale_par: z.string().nullable(),
  description: z.string(),
  gravite: z.number().int().nullable(),
  statut: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type IncidentDisciplinaire = z.infer<typeof IncidentDisciplinaireSchema>

export const SanctionDisciplinaireSchema = z.object({
  id: z.uuid(),
  incident_id: z.string(),
  type_action: z.string(),
  debut: z.coerce.date().nullable(),
  fin: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  decide_par: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type SanctionDisciplinaire = z.infer<typeof SanctionDisciplinaireSchema>

export const RecompenseSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  date: z.coerce.date(),
  points: z.number().int().nullable(),
  raison: z.string().nullable(),
  donne_par: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Recompense = z.infer<typeof RecompenseSchema>

export const CanalCommunicationSchema = z.object({
  type: TypeCanalSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  config_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type CanalCommunication = z.infer<typeof CanalCommunicationSchema>

export const AnnonceSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  titre: z.string(),
  contenu: z.string(),
  publie_le: z.coerce.date().nullable(),
  cree_par: z.string().nullable(),
  cible_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Annonce = z.infer<typeof AnnonceSchema>

export const MessageSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  expediteur_utilisateur_id: z.string(),
  objet: z.string().nullable(),
  corps: z.string(),
  envoye_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Message = z.infer<typeof MessageSchema>

export const MessageDestinataireSchema = z.object({
  message_id: z.string(),
  utilisateur_id: z.string(),
  statut: z.string().nullable(),
  lu_le: z.coerce.date().nullable(),
})

export type MessageDestinataire = z.infer<typeof MessageDestinataireSchema>

export const NotificationSchema = z.object({
  id: z.uuid(),
  utilisateur_id: z.string(),
  type: z.string(),
  payload_json: JsonValueSchema.nullable(),
  lu_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Notification = z.infer<typeof NotificationSchema>

export const CatalogueFraisSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  niveau_scolaire_id: z.string().nullable(),
  usage_scope: z.string(),
  nom: z.string(),
  description: z.string().nullable(),
  montant: DecimalValueSchema,
  devise: z.string(),
  nombre_tranches: z.number().int(),
  mode_facturation: z.string(),
  est_recurrent: z.boolean(),
  periodicite: z.string().nullable(),
  prorata_eligible: z.boolean(),
  eligibilite_json: JsonValueSchema.nullable(),
  plans_paiement_autorises_json: JsonValueSchema.nullable(),
  plan_paiement_defaut_code: z.string().nullable(),
  statut_validation: z.string(),
  approuve_par_utilisateur_id: z.string().nullable(),
  approuve_le: z.coerce.date().nullable(),
  motif_rejet: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type CatalogueFrais = z.infer<typeof CatalogueFraisSchema>

export const PlanPaiementEleveSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  remise_id: z.string().nullable(),
  plan_json: JsonValueSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PlanPaiementEleve = z.infer<typeof PlanPaiementEleveSchema>

export const FacturationRecurrenteExecutionSchema = z.object({
  id: z.uuid(),
  run_id: z.string(),
  etablissement_id: z.string(),
  catalogue_frais_id: z.string(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  facture_id: z.string(),
  created_by_utilisateur_id: z.string().nullable(),
  periodicite: z.string(),
  cycle_key: z.string(),
  cycle_label: z.string(),
  date_reference: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type FacturationRecurrenteExecution = z.infer<typeof FacturationRecurrenteExecutionSchema>

export const FactureSchema = z.object({
  statut: StatutFactureSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  remise_id: z.string().nullable(),
  facture_origine_id: z.string().nullable(),
  nature: z.string(),
  numero_facture: z.string(),
  date_emission: z.coerce.date(),
  date_echeance: z.coerce.date().nullable(),
  total_montant: DecimalValueSchema,
  devise: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Facture = z.infer<typeof FactureSchema>

export const FactureLigneSchema = z.object({
  id: z.uuid(),
  facture_id: z.string(),
  catalogue_frais_id: z.string().nullable(),
  libelle: z.string(),
  quantite: z.number().int(),
  prix_unitaire: DecimalValueSchema,
  montant: DecimalValueSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type FactureLigne = z.infer<typeof FactureLigneSchema>

export const PaiementSchema = z.object({
  id: z.uuid(),
  facture_id: z.string(),
  paye_le: z.coerce.date(),
  montant: DecimalValueSchema,
  statut: z.string(),
  methode: z.string().nullable(),
  numero_recu: z.string().nullable(),
  reference: z.string().nullable(),
  payeur_type: z.string().nullable(),
  payeur_nom: z.string().nullable(),
  payeur_reference: z.string().nullable(),
  recu_par: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Paiement = z.infer<typeof PaiementSchema>

export const OperationFinanciereSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  facture_id: z.string().nullable(),
  paiement_id: z.string().nullable(),
  abonnement_cantine_id: z.string().nullable(),
  cree_par_utilisateur_id: z.string().nullable(),
  type: z.string(),
  montant: DecimalValueSchema.nullable(),
  motif: z.string().nullable(),
  details_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type OperationFinanciere = z.infer<typeof OperationFinanciereSchema>

export const EcheancePaiementSchema = z.object({
  statut: StatutEcheancePaiementSchema,
  id: z.uuid(),
  plan_paiement_id: z.string().nullable(),
  facture_id: z.string().nullable(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  ordre: z.number().int(),
  libelle: z.string().nullable(),
  date_echeance: z.coerce.date(),
  montant_prevu: DecimalValueSchema,
  montant_regle: DecimalValueSchema,
  montant_restant: DecimalValueSchema,
  devise: z.string(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type EcheancePaiement = z.infer<typeof EcheancePaiementSchema>

export const PaiementEcheanceAffectationSchema = z.object({
  id: z.uuid(),
  paiement_id: z.string(),
  echeance_paiement_id: z.string(),
  montant: DecimalValueSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PaiementEcheanceAffectation = z.infer<typeof PaiementEcheanceAffectationSchema>

export const RemiseSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  type: z.string(),
  valeur: z.number(),
  regles_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Remise = z.infer<typeof RemiseSchema>

export const RegleRecouvrementFinanceSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  jours_grace: z.number().int(),
  relance_jours_json: JsonValueSchema.nullable(),
  penalite_active: z.boolean(),
  penalite_mode: z.string().nullable(),
  penalite_valeur: DecimalValueSchema.nullable(),
  statut_validation: z.string(),
  approuve_par_utilisateur_id: z.string().nullable(),
  approuve_le: z.coerce.date().nullable(),
  motif_rejet: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type RegleRecouvrementFinance = z.infer<typeof RegleRecouvrementFinanceSchema>

export const PromessePaiementSchema = z.object({
  statut: StatutPromessePaiementSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  facture_id: z.string().nullable(),
  plan_paiement_id: z.string().nullable(),
  echeance_paiement_id: z.string().nullable(),
  montant_promis: DecimalValueSchema,
  date_promesse: z.coerce.date(),
  date_limite: z.coerce.date(),
  canal: z.string().nullable(),
  note: z.string().nullable(),
  tenue_le: z.coerce.date().nullable(),
  rompue_le: z.coerce.date().nullable(),
  annulee_le: z.coerce.date().nullable(),
  cree_par_utilisateur_id: z.string().nullable(),
  valide_par_utilisateur_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type PromessePaiement = z.infer<typeof PromessePaiementSchema>

export const RestrictionAdministrativeSchema = z.object({
  type: TypeRestrictionAdministrativeSchema,
  statut: StatutRestrictionAdministrativeSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  facture_id: z.string().nullable(),
  plan_paiement_id: z.string().nullable(),
  source: z.string().nullable(),
  motif: z.string().nullable(),
  date_activation: z.coerce.date(),
  date_levee: z.coerce.date().nullable(),
  cree_par_utilisateur_id: z.string().nullable(),
  levee_par_utilisateur_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type RestrictionAdministrative = z.infer<typeof RestrictionAdministrativeSchema>

export const DossierRecouvrementSchema = z.object({
  statut: StatutDossierRecouvrementSchema,
  id: z.uuid(),
  etablissement_id: z.string(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  facture_id: z.string().nullable(),
  plan_paiement_id: z.string().nullable(),
  motif: z.string().nullable(),
  note: z.string().nullable(),
  montant_reference: DecimalValueSchema.nullable(),
  date_statut: z.coerce.date(),
  cree_par_utilisateur_id: z.string().nullable(),
  valide_par_utilisateur_id: z.string().nullable(),
  valide_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type DossierRecouvrement = z.infer<typeof DossierRecouvrementSchema>

export const RessourceBibliothequeSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  type: z.string(),
  titre: z.string(),
  code: z.string().nullable(),
  auteur: z.string().nullable(),
  editeur: z.string().nullable(),
  annee: z.number().int().nullable(),
  stock: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type RessourceBibliotheque = z.infer<typeof RessourceBibliothequeSchema>

export const EmpruntSchema = z.object({
  id: z.uuid(),
  ressource_bibliotheque_id: z.string(),
  eleve_id: z.string().nullable(),
  personnel_id: z.string().nullable(),
  emprunte_le: z.coerce.date(),
  du_le: z.coerce.date().nullable(),
  retourne_le: z.coerce.date().nullable(),
  statut: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Emprunt = z.infer<typeof EmpruntSchema>

export const LigneTransportSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  catalogue_frais_id: z.string().nullable(),
  infos_vehicule_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type LigneTransport = z.infer<typeof LigneTransportSchema>

export const ArretTransportSchema = z.object({
  id: z.uuid(),
  ligne_transport_id: z.string(),
  nom: z.string(),
  geo_json: JsonValueSchema.nullable(),
  ordre: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ArretTransport = z.infer<typeof ArretTransportSchema>

export const AbonnementTransportSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  ligne_transport_id: z.string(),
  arret_transport_id: z.string().nullable(),
  zone_transport: z.string().nullable(),
  facture_id: z.string().nullable(),
  a_facturer: z.boolean(),
  statut: z.string().nullable(),
  date_debut_service: z.coerce.date().nullable(),
  date_fin_service: z.coerce.date().nullable(),
  prorata_ratio: DecimalValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type AbonnementTransport = z.infer<typeof AbonnementTransportSchema>

export const HistoriqueAffectationTransportSchema = z.object({
  id: z.uuid(),
  abonnement_transport_id: z.string(),
  ancienne_ligne_transport_id: z.string(),
  ancien_arret_transport_id: z.string().nullable(),
  ancienne_zone_transport: z.string().nullable(),
  nouvelle_ligne_transport_id: z.string(),
  nouvel_arret_transport_id: z.string().nullable(),
  nouvelle_zone_transport: z.string().nullable(),
  date_effet: z.coerce.date(),
  impact_tarifaire: z.boolean(),
  ancien_statut: z.string().nullable(),
  nouveau_statut: z.string().nullable(),
  details_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type HistoriqueAffectationTransport = z.infer<typeof HistoriqueAffectationTransportSchema>

export const FormuleCantineSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  nom: z.string(),
  type_formule: z.string(),
  catalogue_frais_id: z.string().nullable(),
  transmettre_consommations_finance: z.boolean(),
  max_repas_par_jour: z.number().int(),
  regulariser_absence_annulation: z.boolean(),
  mode_regularisation_absence: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type FormuleCantine = z.infer<typeof FormuleCantineSchema>

export const AbonnementCantineSchema = z.object({
  id: z.uuid(),
  eleve_id: z.string(),
  annee_scolaire_id: z.string(),
  formule_cantine_id: z.string(),
  facture_id: z.string().nullable(),
  statut: z.string().nullable(),
  date_effet: z.coerce.date().nullable(),
  solde_prepaye: DecimalValueSchema,
  solde_min_alerte: DecimalValueSchema,
  dernier_rechargement_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type AbonnementCantine = z.infer<typeof AbonnementCantineSchema>

export const HistoriqueFormuleCantineSchema = z.object({
  id: z.uuid(),
  abonnement_cantine_id: z.string(),
  ancienne_formule_cantine_id: z.string(),
  nouvelle_formule_cantine_id: z.string(),
  date_effet: z.coerce.date(),
  impact_tarifaire: z.boolean(),
  ancien_statut: z.string().nullable(),
  nouveau_statut: z.string().nullable(),
  details_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type HistoriqueFormuleCantine = z.infer<typeof HistoriqueFormuleCantineSchema>

export const ConsommationCantineSchema = z.object({
  id: z.uuid(),
  abonnement_cantine_id: z.string(),
  type_repas: z.string(),
  note: z.string().nullable(),
  consommation_le: z.coerce.date(),
  statut_acces: z.string(),
  motif_acces: z.string().nullable(),
  finance_status_snapshot: z.string().nullable(),
  transmission_finance: z.boolean(),
  finance_processed_at: z.coerce.date().nullable(),
  details_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type ConsommationCantine = z.infer<typeof ConsommationCantineSchema>

export const AbsenceCantineSchema = z.object({
  id: z.uuid(),
  abonnement_cantine_id: z.string(),
  type_evenement: z.string(),
  date_repas: z.coerce.date(),
  etat_metier: z.string(),
  note: z.string().nullable(),
  statut_acces_snapshot: z.string().nullable(),
  finance_status_snapshot: z.string().nullable(),
  ouvre_droit_regularisation: z.boolean(),
  mode_regularisation_suggere: z.string().nullable(),
  transmission_finance: z.boolean(),
  finance_processed_at: z.coerce.date().nullable(),
  decision_finance: z.string().nullable(),
  details_json: JsonValueSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type AbsenceCantine = z.infer<typeof AbsenceCantineSchema>

export const FichierSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  proprietaire_utilisateur_id: z.string().nullable(),
  fournisseur_stockage: z.string().nullable(),
  chemin: z.string(),
  type_mime: z.string().nullable(),
  taille: z.number().int().nullable(),
  checksum: z.string().nullable(),
  televerse_le: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Fichier = z.infer<typeof FichierSchema>

export const LienFichierSchema = z.object({
  id: z.uuid(),
  fichier_id: z.string(),
  type_entite: z.string(),
  id_entite: z.string(),
  tag: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type LienFichier = z.infer<typeof LienFichierSchema>

export const DocumentTypeInscriptionSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string().nullable(),
  code: z.string(),
  nom: z.string(),
  description: z.string().nullable(),
  type_inscriptions_json: JsonValueSchema.nullable(),
  est_obligatoire_par_defaut: z.boolean(),
  est_actif: z.boolean(),
  ordre: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type DocumentTypeInscription = z.infer<typeof DocumentTypeInscriptionSchema>

export const InscriptionDocumentSchema = z.object({
  statut: StatutDocumentInscriptionSchema,
  id: z.uuid(),
  inscription_id: z.string(),
  document_type_id: z.string(),
  fichier_id: z.string().nullable(),
  verifie_par_utilisateur_id: z.string().nullable(),
  obligatoire: z.boolean(),
  fourni: z.boolean(),
  date_depot: z.coerce.date().nullable(),
  date_verification: z.coerce.date().nullable(),
  commentaire_admin: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type InscriptionDocument = z.infer<typeof InscriptionDocumentSchema>

export const JournalAuditSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  acteur_utilisateur_id: z.string().nullable(),
  action: z.string(),
  type_entite: z.string().nullable(),
  id_entite: z.string().nullable(),
  avant_json: JsonValueSchema.nullable(),
  apres_json: JsonValueSchema.nullable(),
  ip: z.string().nullable(),
  date_action: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type JournalAudit = z.infer<typeof JournalAuditSchema>

export const WebhookSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  url: z.string(),
  evenements_json: JsonValueSchema.nullable(),
  secret: z.string().nullable(),
  est_actif: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Webhook = z.infer<typeof WebhookSchema>

export const JetonIntegrationSchema = z.object({
  id: z.uuid(),
  etablissement_id: z.string(),
  fournisseur: z.string(),
  token_json: JsonValueSchema,
  expire_le: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type JetonIntegration = z.infer<typeof JetonIntegrationSchema>
