import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepSecurite({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        La plateforme connait deja la structure des roles et permissions. Cette etape garde
        le cadrage visible pour le futur moteur de generation securite.
      </p>
      <BlockActionSelector
        value={draft.security_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            security_mode: value,
          }))
        }
      />
    </div>
  );
}
