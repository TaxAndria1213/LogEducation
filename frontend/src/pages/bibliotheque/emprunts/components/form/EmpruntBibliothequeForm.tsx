import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import EleveService from "../../../../../services/eleve.service";
import PersonnelService from "../../../../../services/personnel.service";
import RessourceBibliothequeService, {
  getAvailableStock,
  type RessourceBibliothequeWithRelations,
} from "../../../../../services/ressourceBibliotheque.service";
import EmpruntBibliothequeService from "../../../../../services/empruntBibliotheque.service";

const schema = z.object({
  ressource_bibliotheque_id: z.string().min(1, "La ressource est requise."),
  emprunteur_type: z.enum(["eleve", "personnel"]),
  eleve_id: z.string().optional(),
  personnel_id: z.string().optional(),
  emprunte_le: z.string().min(1, "La date d'emprunt est requise."),
  du_le: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.emprunteur_type === "eleve" && !data.eleve_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eleve_id"], message: "Selectionne un eleve." });
  }
  if (data.emprunteur_type === "personnel" && !data.personnel_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personnel_id"], message: "Selectionne un membre du personnel." });
  }
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "L'emprunt n'a pas pu etre enregistre.";
}

function getEleveLabel(item: any) {
  return [item?.code_eleve, item?.utilisateur?.profil?.prenom, item?.utilisateur?.profil?.nom].filter(Boolean).join(" ").trim();
}

function getPersonnelLabel(item: any) {
  return [item?.matricule, item?.utilisateur?.profil?.prenom, item?.utilisateur?.profil?.nom].filter(Boolean).join(" ").trim();
}

export default function EmpruntBibliothequeForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new EmpruntBibliothequeService(), []);
  const [ressources, setRessources] = useState<RessourceBibliothequeWithRelations[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [personnels, setPersonnels] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;
      const ressourceService = new RessourceBibliothequeService();
      const eleveService = new EleveService();
      const personnelService = new PersonnelService();
      const [ressourceResult, eleveResult, personnelResult] = await Promise.all([
        ressourceService.getForEtablissement(etablissement_id, {
          take: 500,
          includeSpec: JSON.stringify({ emprunts: { where: { retourne_le: null } } }),
        }),
        eleveService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ utilisateur: { include: { profil: true } } }),
        }),
        personnelService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ utilisateur: { include: { profil: true } } }),
        }),
      ]);

      const nextRessources = (
        ressourceResult?.status.success
          ? (ressourceResult.data.data as RessourceBibliothequeWithRelations[])
          : []
      ).filter((item) => getAvailableStock(item) > 0);

      setRessources(nextRessources);
      setEleves(eleveResult?.status.success ? eleveResult.data.data : []);
      setPersonnels(personnelResult?.status.success ? personnelResult.data.data : []);
    };
    void load();
  }, [etablissement_id]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ressource_bibliotheque_id: "",
      emprunteur_type: "eleve",
      eleve_id: "",
      personnel_id: "",
      emprunte_le: new Date().toISOString().slice(0, 16),
      du_le: "",
    },
  });

  const emprunteurType = form.watch("emprunteur_type");

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({
        etablissement_id,
        ressource_bibliotheque_id: data.ressource_bibliotheque_id,
        eleve_id: data.emprunteur_type === "eleve" ? data.eleve_id || null : null,
        personnel_id: data.emprunteur_type === "personnel" ? data.personnel_id || null : null,
        emprunte_le: new Date(data.emprunte_le),
        du_le: data.du_le ? new Date(data.du_le) : null,
      });
      info("Emprunt cree avec succes !", "success");
      form.reset({
        ressource_bibliotheque_id: "",
        emprunteur_type: "eleve",
        eleve_id: "",
        personnel_id: "",
        emprunte_le: new Date().toISOString().slice(0, 16),
        du_le: "",
      });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="ressource_bibliotheque_id" render={({ field, fieldState }) => <FieldWrapper id="ressource_bibliotheque_id" label="Ressource" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner une ressource</option>{ressources.map((item) => <option key={item.id} value={item.id}>{item.titre} - disponible {getAvailableStock(item)}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="emprunteur_type" render={({ field, fieldState }) => <FieldWrapper id="emprunteur_type" label="Type d'emprunteur" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="eleve">Eleve</option><option value="personnel">Personnel</option></select></FieldWrapper>} />
        {emprunteurType === "eleve" ? (
          <Controller control={form.control} name="eleve_id" render={({ field, fieldState }) => <FieldWrapper id="eleve_id" label="Eleve" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un eleve</option>{eleves.map((item) => <option key={item.id} value={item.id}>{getEleveLabel(item)}</option>)}</select></FieldWrapper>} />
        ) : (
          <Controller control={form.control} name="personnel_id" render={({ field, fieldState }) => <FieldWrapper id="personnel_id" label="Personnel" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un membre du personnel</option>{personnels.map((item) => <option key={item.id} value={item.id}>{getPersonnelLabel(item)}</option>)}</select></FieldWrapper>} />
        )}
        <Controller control={form.control} name="emprunte_le" render={({ field, fieldState }) => <FieldWrapper id="emprunte_le" label="Date d'emprunt" required error={fieldState.error?.message}><input type="datetime-local" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="du_le" render={({ field, fieldState }) => <FieldWrapper id="du_le" label="Retour prevu" error={fieldState.error?.message}><input type="datetime-local" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
