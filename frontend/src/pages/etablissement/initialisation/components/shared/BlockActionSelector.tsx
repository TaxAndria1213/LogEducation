import { FiClock, FiCopy, FiPlusCircle } from "react-icons/fi";
import type { InitialisationBlockMode } from "../../types";

const options: {
  value: InitialisationBlockMode;
  label: string;
  help: string;
  icon: typeof FiPlusCircle;
}[] = [
  {
    value: "CREATION",
    label: "Creation",
    help: "Le bloc est vise pour une creation immediate.",
    icon: FiPlusCircle,
  },
  {
    value: "REPRISE",
    label: "Reprise",
    help: "Le bloc s'appuie sur l'existant ou sur l'annee precedente.",
    icon: FiCopy,
  },
  {
    value: "PLUS_TARD",
    label: "Plus tard",
    help: "Le bloc reste visible mais ne sera pas genere maintenant.",
    icon: FiClock,
  },
];

type Props = {
  value: InitialisationBlockMode;
  onChange: (value: InitialisationBlockMode) => void;
};

export default function BlockActionSelector({ value, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Mode du bloc">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`rounded-[22px] border px-4 py-4 text-left transition ${
              selected
                ? "border-cyan-300 bg-cyan-50 shadow-sm shadow-cyan-100/70"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    selected ? "bg-white text-cyan-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.help}</p>
                </div>
              </div>
              <span
                className={`mt-1 h-3 w-3 rounded-full transition ${
                  selected ? "bg-cyan-500" : "bg-slate-200"
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
