import PrismaService from "../../../service/prisma_service";

class PaiementModel extends PrismaService {
  constructor() {
    super("paiement", {
      paiement: [
        "facture",
        "facture.eleve",
        "facture.eleve.utilisateur",
        "facture.eleve.utilisateur.profil",
        "facture.annee",
        "facture.echeances",
        "facture.echeances.affectations",
        "affectations",
        "affectations.echeance",
      ],
    });
  }
}

export default PaiementModel;
