import { prisma } from "../../../service/prisma";

class InitialisationEtablissementModel {
  public async getStatus(etablissementId: string) {
    const [
      etablissement,
      activeYear,
      siteCount,
      yearCount,
      levelCount,
      classCount,
      departementCount,
      matiereCount,
      roleCount,
      permissionCount,
      transportLineCount,
      cantineFormulaCount,
    ] = await Promise.all([
      prisma.etablissement.findUnique({
        where: { id: etablissementId },
        select: { id: true, nom: true, code: true, created_at: true },
      }),
      prisma.anneeScolaire.findFirst({
        where: {
          etablissement_id: etablissementId,
          est_active: true,
        },
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          nom: true,
          date_debut: true,
          date_fin: true,
        },
      }),
      prisma.site.count({ where: { etablissement_id: etablissementId } }),
      prisma.anneeScolaire.count({ where: { etablissement_id: etablissementId } }),
      prisma.niveauScolaire.count({ where: { etablissement_id: etablissementId } }),
      prisma.classe.count({ where: { etablissement_id: etablissementId } }),
      prisma.departement.count({ where: { etablissement_id: etablissementId } }),
      prisma.matiere.count({ where: { etablissement_id: etablissementId } }),
      prisma.role.count({ where: { etablissement_id: etablissementId } }),
      prisma.permission.count({ where: { etablissement_id: etablissementId } }),
      prisma.ligneTransport.count({ where: { etablissement_id: etablissementId } }),
      prisma.formuleCantine.count({ where: { etablissement_id: etablissementId } }),
    ]);

    if (!etablissement) {
      throw new Error("Etablissement introuvable pour cette initialisation.");
    }

    const scoreCriteria = [
      siteCount > 0,
      yearCount > 0,
      levelCount > 0,
      departementCount > 0,
      matiereCount > 0,
      roleCount > 0,
    ];
    const completionRate = Math.round(
      (scoreCriteria.filter(Boolean).length / scoreCriteria.length) * 100,
    );

    return {
      etablissement,
      active_year: activeYear,
      counts: {
        sites: siteCount,
        annees: yearCount,
        niveaux: levelCount,
        classes: classCount,
        departements: departementCount,
        matieres: matiereCount,
        roles: roleCount,
        permissions: permissionCount,
        lignes_transport: transportLineCount,
        formules_cantine: cantineFormulaCount,
      },
      completion_rate: completionRate,
      ready_for_operational_start:
        siteCount > 0 && yearCount > 0 && levelCount > 0 && departementCount > 0,
      ready_for_new_school_year: yearCount > 0,
    };
  }

  public async getVirtualSessions(etablissementId: string) {
    const years = await prisma.anneeScolaire.findMany({
      where: { etablissement_id: etablissementId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        nom: true,
        est_active: true,
        created_at: true,
        date_debut: true,
        date_fin: true,
      },
      take: 20,
    });

    const status = await this.getStatus(etablissementId);

    const yearSessions = years.map((year) => ({
      id: year.id,
      type: "NOUVELLE_ANNEE_SCOLAIRE",
      label: year.nom,
      statut: year.est_active ? "ACTIVE" : "TERMINEE",
      created_at: year.created_at,
      summary: `Annee scolaire ${year.nom} creee pour l'etablissement.`,
      details: {
        date_debut: year.date_debut,
        date_fin: year.date_fin,
      },
    }));

    const bootstrapSession = {
      id: `bootstrap-${etablissementId}`,
      type: "NOUVEL_ETABLISSEMENT",
      label: "Amorcage etablissement",
      statut: status.ready_for_operational_start ? "OPERATIONNEL" : "EN_PREPARATION",
      created_at: status.etablissement.created_at,
      summary: `Progression actuelle de l'amorcage: ${status.completion_rate}%.`,
      details: status.counts,
    };

    return [bootstrapSession, ...yearSessions];
  }
}

export default InitialisationEtablissementModel;
