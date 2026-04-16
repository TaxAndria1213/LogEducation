import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepAuditNotifications({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Cette etape reserve la place du journal d'audit, des modeles de notification et des
        traces de demarrage. Elle reste visible pour garder la vision transverse du produit.
      </p>
      <BlockActionSelector
        value={draft.audit_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            audit_mode: value,
          }))
        }
      />
    </div>
  );
}
