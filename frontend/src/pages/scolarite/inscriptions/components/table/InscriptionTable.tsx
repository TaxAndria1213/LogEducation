/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Inscription } from "../../../../../types/models";
import InscriptionService from "../../../../../services/inscription.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import ClasseService from "../../../../../services/classe.service";

export default function InscriptionList() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new InscriptionService(), []);
  const [classeOptions, setClasseOptions] = useState<Array<{ id: string; nom: string; annee_scolaire_id?: string | null }>>([]);

  useEffect(() => {
    let active = true;

    const loadClasses = async () => {
      if (!etablissement_id) return;
      try {
        const result = await new ClasseService().getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        });
        if (!active) return;
        setClasseOptions(result?.status.success ? (result.data.data as Array<{ id: string; nom: string; annee_scolaire_id?: string | null }>) : []);
      } catch {
        if (!active) return;
        setClasseOptions([]);
      }
    };

    void loadClasses();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const columns: ColumnDef<Inscription>[] = [
    {
      key: "code_eleve",
      header: "Code élève",
      render: (row: any) => row.eleve?.code_eleve ?? "—",
      sortable: false,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "classe",
      header: "Classe",
      render: (row: any) => row.classe?.nom ?? "—",
      sortable: false,
      sortKey: "classe.nom",
    },
    {
      key: "annee",
      header: "Année scolaire",
      render: (row: any) => row.annee?.nom ?? "—",
      sortable: false,
      sortKey: "annee.nom",
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "created_at",
      header: "Inscrit le",
      accessor: "date_inscription",
      sortable: true,
      sortKey: "date_inscription",
      render: (row) => {
        const date = formatDateWithLocalTimezone(row.date_inscription.toString());
        return date.date;
      },
    },
  ];

  const actions: RowAction<Inscription>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => {
        console.log("voir", row.id);
      },
    },
    {
      label: "Changer de classe",
      variant: "primary",
      onClick: async (row: any) => {
        const currentClasseId = row.classe_id ?? row.classe?.id ?? null;
        const currentAnneeId = row.annee_scolaire_id ?? row.annee?.id ?? null;
        const availableClasses = classeOptions.filter(
          (item) => item.annee_scolaire_id === currentAnneeId && item.id !== currentClasseId,
        );

        if (availableClasses.length === 0) {
          info("Aucune autre classe disponible sur cette annee pour ce transfert.", "warning");
          return;
        }

        const choices = availableClasses
          .map((item) => `${item.id} -> ${item.nom}`)
          .join("\n");
        const selectedClasseId = window.prompt(
          `Entrez l'identifiant de la nouvelle classe:\n${choices}`,
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

        await service.changeClass(row.id, {
          classe_id: selectedClasse.id,
          date_effet: dateEffet || new Date().toISOString().slice(0, 10),
          generer_regularisation_financiere: true,
          motif: `Changement de classe depuis la liste des inscriptions vers ${selectedClasse.nom}`,
        });
        info("Classe modifiee et regularisation financee traitee.", "success");
        tableRef.current?.refresh();
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Voulez-vous supprimer ce site ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        // DataTable refresh auto? (ici non) -> on préfère passer action via hook,
        // mais simplest: on force reload via window ou via un ref.
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Inscription>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          eleve: true,
          classe: true,
          annee: true,
        },
        where: { annee: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { eleve: { code_eleve: { contains: text } } },
          { classe: { nom: { contains: text } } },
          { annee: { nom: { contains: text } } },
        ],
        annee: { etablissement_id },
      })}
    />
  );
}
