import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepFinance({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Le socle financier doit couvrir les categories de frais, les statuts et les
        echeances. Pour l'instant, le wizard documente ce bloc avant une generation plus
        fine.
      </p>
      <BlockActionSelector
        value={draft.finance_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            finance_mode: value,
          }))
        }
      />
    </div>
  );
}
