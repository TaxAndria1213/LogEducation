import { useMemo } from "react";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { PermissionSchema } from "../../../../../generated/zod";
import PermissionService from "../../../../../services/permission.service";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Permission } from "../../../../../types/models";
import { componentPermissionCatalog } from "../../../../../components/components.build";
import { normalizePermissionCode } from "../../../../../utils/permissionScope";

export default function PermissionForm() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new PermissionService(), []);
  const systemCodes = useMemo(
    () => new Set(componentPermissionCatalog.map((item) => item.code)),
    [],
  );

  const permissionFields = getFieldsFromZodObjectSchema(PermissionSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    labelByField: {
      code: "Code de permission personnalisee",
      description: "Description",
    },
  });

  const permissionSchema = useMemo(
    () =>
      PermissionSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        etablissement_id: true,
      }).superRefine((value, ctx) => {
        const normalizedCode = normalizePermissionCode(value.code);

        if (!normalizedCode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["code"],
            message: "Le code de permission est obligatoire.",
          });
          return;
        }

        if (systemCodes.has(normalizedCode)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["code"],
            message:
              "Ce code est deja reserve par une permission systeme issue des CI.",
          });
        }
      }),
    [systemCodes],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Ajouter une permission personnalisee
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Les permissions issues des CI restent systeme et ne vont plus en base.
          Ici, tu ajoutes uniquement des permissions supplementaires propres a
          l'etablissement courant.
        </p>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <Form
          schema={permissionSchema}
          fields={permissionFields}
          initialValues={{} as Partial<Permission>}
          service={{
            create: async (data: Partial<Permission>) => {
              if (!etablissement_id) {
                throw new Error(
                  "Aucun etablissement actif n'est disponible pour creer cette permission.",
                );
              }

              return service.create({
                ...data,
                code: normalizePermissionCode(data.code) ?? "",
                description:
                  typeof data.description === "string"
                    ? data.description.trim() || null
                    : data.description,
                etablissement_id,
              });
            },
          }}
          labelMessage={"Permission personnalisee"}
        />
      </section>
    </div>
  );
}
