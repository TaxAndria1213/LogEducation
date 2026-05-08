import { useEffect, useMemo, useState } from "react";
import {
  FiCopy,
  FiFileText,
  FiKey,
  FiLayers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import RoleService from "../../../../../services/role.service";
import type { Role } from "../../../../../types/models";
import { buildAccountCreationUrl } from "../../../../../utils/accountCreationLink";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Impossible de charger les roles du personnel.";
}

function PersonnelAccountRolePicker() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadRoles = async () => {
      if (!etablissement_id) {
        setRoles([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new RoleService();
        const result = await service.getAll({
          page: 1,
          take: 200,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        setRoles(result?.status.success ? ((result.data.data as Role[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
        setRoles([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRoles();

    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const roleChoices = useMemo(
    () =>
      [...roles].sort((left, right) =>
        (left.nom ?? "").localeCompare(right.nom ?? "", "fr", {
          sensitivity: "base",
        }),
      ),
    [roles],
  );

  const configuredCount = roleChoices.length;

  const copyCreationLink = async (role: Role) => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est disponible pour generer ce lien.", "warning");
      return;
    }

    try {
      const finalUrl = buildAccountCreationUrl({
        roleId: role.id,
        etablissementId: etablissement_id,
        roleName: role.nom,
      });

      await navigator.clipboard.writeText(finalUrl);
      info(
        `Lien de creation utilisateur pour ${role.nom} copie dans le presse-papiers.`,
        "success",
      );
    } catch (error) {
      console.warn("Impossible de copier le lien de creation du personnel.", error);
      info("Impossible de copier le lien de creation du personnel.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement des roles...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Creation de compte personnel
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              L'ajout ne passe plus par le formulaire par defaut. Choisis un
              role deja configure dans le module Compte et securite, puis copie
              le lien de creation du compte a partager avec la personne
              concernee.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {configuredCount} roles disponibles
            </span>
          </div>
        </div>
      </section>

      {roleChoices.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleChoices.map((role) => (
            <article
              key={role.id}
              className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiKey />
                </div>

                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Disponible
                </span>
              </div>

              <div className="mt-5">
                <h3 className="text-base font-semibold text-slate-900">
                  {role.nom?.trim() || "Role sans nom"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ce role provient directement de la liste des roles du module
                  Compte et securite.
                </p>
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Role relie
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {role.nom?.trim() || "Role sans nom"}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-slate-500">
                  <FiLayers />
                  <span>Selectionne exactement comme dans Compte et securite.</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => void copyCreationLink(role)}
                disabled={!etablissement_id}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <FiCopy />
                <span>Copier le lien de creation</span>
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
          Aucun role n'est encore disponible dans le module Compte et securite
          pour cet etablissement.
        </section>
      )}
    </div>
  );
}

export default PersonnelAccountRolePicker;
