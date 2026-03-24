import PrismaService from "../../../service/prisma_service";

class PlanPaiementEleveModel extends PrismaService {
  constructor() {
    super("planPaiementEleve", {
      planPaiementEleve: [
        "eleve",
        "eleve.utilisateur",
        "eleve.utilisateur.profil",
        "annee",
        "echeances",
        "echeances.affectations",
      ],
    });
  }
}

export default PlanPaiementEleveModel;
