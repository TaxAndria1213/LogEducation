import type { menu } from "../types/types";
import { audit_integrations } from "./modules/audit_integrations.routes";
import { bibliothque } from "./modules/bibliothque.routes";
import { communication } from "./modules/communication.routes";
import { comptes_securite } from "./modules/comptes_securite.routes";
import { dashboard } from "./modules/dashboard.routes";
import { discipline } from "./modules/discipline.routes";
import { documents } from "./modules/documents.routes";
import { emploi_du_temps } from "./modules/emploi_du_temps.routes";
import { etablissement } from "./modules/etablissement.routes";
import { finance } from "./modules/finance.routes";
import { pedagogie } from "./modules/pedagogie.routes";
import { personnel } from "./modules/personnel.routes";
import { presences } from "./modules/presences.routes";
import { scolarite } from "./modules/scolarite.routes";
import { transport_cantine } from "./modules/transport_cantine.routes";

export const modules: menu[] = [
  dashboard,
  etablissement,
  comptes_securite,
  scolarite,
  personnel,
  pedagogie,
  emploi_du_temps,
  presences,
  discipline,
  communication,
  finance,
  bibliothque,
  transport_cantine,
  documents,
  audit_integrations,
];
