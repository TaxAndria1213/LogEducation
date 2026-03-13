import { Application, Router } from "express";
import UserApp from "../modules/user/application/user.app";
import EtablissementApp from "../modules/etablissement/application/etablissement.app";
import RolesApp from "../modules/roles/application/roles.app";
import RoleUserApp from "../modules/roles_user/application/roles_user.app";
import SiteApp from "../modules/site/application/site.app";
import ProfileApp from "../modules/profile/application/profile.app";
import { tenantMiddleware } from "../../middleware/tenant";
import SalleApp from "../modules/salle/application/salle.app";
import AnneeScolaireApp from "../modules/annee_scolaire/application/anneeScolaire.app";
import PeriodeApp from "../modules/periode/application/periode.app";
import ReferencielApp from "../modules/referenciel/application/referenciel.app";
import InscriptionApp from "../modules/inscription/application/inscription.app";
import ClasseApp from "../modules/classe/application/classe.app";
import NiveauApp from "../modules/niveau/application/niveau.app";
import ParentTuteurApp from "../modules/parent_tuteur/application/parent_tuteur.app";
import IdentifiantEleveApp from "../modules/identifiant_eleve/application/identifiant_eleve.app";
import EleveApp from "../modules/eleve/application/eleve.app";

export class ApiRoutes {
  public app: Application;
  private router: Router;

  //utilisateur
  private user: UserApp;
  private roles: RolesApp;
  private rolesUser: RoleUserApp;
  private profile: ProfileApp;
  
  //Etablissement
  private etablissement: EtablissementApp;
  private site: SiteApp;
  private salle: SalleApp;
  private anneeScolaire: AnneeScolaireApp;
  private periode: PeriodeApp;
  private referenciel: ReferencielApp;

  //scolarité
  private inscription: InscriptionApp;
  private classe: ClasseApp;
  private niveau: NiveauApp;
  private parentTuteur: ParentTuteurApp;
  private identifiantEleve: IdentifiantEleveApp;
  private eleve: EleveApp;


  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.user = new UserApp(app);
    this.roles = new RolesApp(app);
    this.rolesUser = new RoleUserApp(app);
    this.profile = new ProfileApp(app);
    this.etablissement = new EtablissementApp(app);
    this.site = new SiteApp(app);
    this.salle = new SalleApp(app);
    this.anneeScolaire = new AnneeScolaireApp(app);
    this.periode = new PeriodeApp(app);
    this.referenciel = new ReferencielApp(app);
    this.inscription = new InscriptionApp(app);
    this.classe = new ClasseApp(app);
    this.niveau = new NiveauApp(app);
    this.parentTuteur = new ParentTuteurApp(app);
    this.identifiantEleve = new IdentifiantEleveApp(app);
    this.eleve = new EleveApp(app);
    this.routes();
  }

  public routes(): Router {
    this.router.use(tenantMiddleware); // Appliquer le middleware tenant à toutes les routes suivantes
    
    //Utilisateur
    this.router.use('/roles', this.roles.routes());
    this.router.use('/user', this.user.routes());
    this.router.use('/roles_user', this.rolesUser.routes());
    this.router.use('/profile', this.profile.routes());
    
    //Etablissement
    this.router.use('/etablissement', this.etablissement.routes());
    this.router.use('/site', this.site.routes());
    this.router.use('/salle', this.salle.routes());
    this.router.use('/annee-scolaire', this.anneeScolaire.routes());
    this.router.use('/periode', this.periode.routes());
    this.router.use('/referenciel', this.referenciel.routes());

    //scolarité
    this.router.use('/inscription', this.inscription.routes());
    this.router.use('/classe', this.classe.routes());
    this.router.use('/niveau-scolaire', this.niveau.routes());
    this.router.use('/parent-tuteur', this.parentTuteur.routes());
    this.router.use('/identifiantEleve', this.identifiantEleve.routes());
    this.router.use('/eleve', this.eleve.routes());
    

    return this.router;
  }
}



