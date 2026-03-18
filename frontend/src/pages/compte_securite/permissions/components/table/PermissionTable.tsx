import React, { useMemo, useState } from "react";
import { componentPermissionCatalog } from "../../../../../components/components.build";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import type { Permission } from "../../../../../types/models";
import PermissionService from "../../../../../services/permission.service";
import { useAuth } from "../../../../../auth/AuthContext";

export default function PermissionList() {
  const { etablissement_id } = useAuth();
  const [search, setSearch] = useState("");
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PermissionService(), []);

  const rows = useMemo(() => {
    const text = search.trim().toLowerCase();
    return componentPermissionCatalog.filter((item) => {
      if (!text) return true;
      return (
        item.code.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text)
      );
    });
  }, [search]);

  const columns: ColumnDef<Permission>[] = [
    {
      key: "code",
      header: "Code",
      accessor: "code",
      sortable: true,
      sortKey: "code",
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.description ?? "-",
    },
  ];

  const actions: RowAction<Permission>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Voulez-vous supprimer cette permission personnalisee ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Catalogue des permissions systeme
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Ces permissions proviennent directement des codes CI du projet.
              Elles servent de reference dans les affectations, sans etre creees
              comme donnees metier en base.
            </p>
          </div>

          <label className="grid gap-1 text-sm text-slate-600">
            <span>Recherche</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Code ou description"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Permissions personnalisees en base
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Seules les permissions ajoutees manuellement par l'utilisateur sont
          enregistrees ici.
        </p>

        <div className="mt-4">
          <DataTable<Permission>
            ref={tableRef}
            service={service}
            columns={columns}
            actions={actions}
            getRowId={(r) => r.id}
            initialQuery={{
              page: 1,
              take: 10,
              where: { etablissement_id },
            }}
            showSearch={false}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Catalogue systeme des permissions CI
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Ces permissions sont globales au systeme et ne sont plus stockees
            en base.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left text-sm text-slate-600">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.code} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-sm text-slate-900">
                    {item.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {item.adminOnly ? "Admin only" : "Standard"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Aucune permission systeme ne correspond a la recherche.
          </div>
        ) : null}
      </section>
    </div>
  );
}
