import type { InitialisationPreview } from "../../types";
import ResumeDiffPanel from "../shared/ResumeDiffPanel";

type Props = {
  preview: InitialisationPreview | null;
};

export default function StepResumeGeneration({ preview }: Props) {
  return <ResumeDiffPanel preview={preview} />;
}
