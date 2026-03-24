import PrismaService from "../../../service/prisma_service";

class FactureModel extends PrismaService {
  constructor() {
    super("facture", {
      facture: [
        "eleve",
        "eleve.utilisateur",
        "eleve.utilisateur.profil",
        "annee",
        "lignes",
        "lignes.frais",
        "paiements",
        "echeances",
        "echeances.affectations",
      ],
    });
  }
}

export default FactureModel;
