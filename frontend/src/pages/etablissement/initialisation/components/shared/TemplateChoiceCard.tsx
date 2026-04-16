type Props = {
  label: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
};

export default function TemplateChoiceCard({
  label,
  description,
  selected,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-[22px] border px-4 py-4 text-left transition ${
        selected
          ? "border-emerald-300 bg-emerald-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </button>
  );
}
