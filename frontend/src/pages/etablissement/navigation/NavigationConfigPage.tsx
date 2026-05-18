import { useState, type ComponentType } from "react";
import { FiMenu, FiMousePointer, FiFrown } from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import {
  type ERPPageNavigationMode,
  setERPPageNavigationMode,
  useERPPageNavigationMode,
} from "../../../components/page/navigationPreference";

const options: Array<{
  value: ERPPageNavigationMode;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    value: "dropdown",
    title: "Bouton menu puis dropdown",
    description:
      "Le header interne affiche un bouton menu. Les actions s'ouvrent ensuite dans un menu deroulant.",
    icon: FiMenu,
  },
  {
    value: "inline",
    title: "Menus directement sur le header",
    description:
      "Les actions internes sont visibles directement dans le header de la page ERPPage.",
    icon: FiFrown,
  },
];

export default function NavigationConfigPage() {
  const currentMode = useERPPageNavigationMode();
  const [selectedMode, setSelectedMode] =
    useState<ERPPageNavigationMode>(currentMode);

  const applyMode = (mode: ERPPageNavigationMode) => {
    setSelectedMode(mode);
    setERPPageNavigationMode(mode);
  };

  return (
    <ERPPage
      title="Configuration de navigation"
      description="Choisis la presentation des menus internes dans le header ERPPage."
    >
      <section className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
              <FiMousePointer />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                Navigation des pages internes
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ce choix est enregistre localement dans le navigateur et s'applique aux
                pages qui utilisent le composant ERPPage.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {options.map((option) => {
              const Icon = option.icon;
              const checked = selectedMode === option.value;

              return (
                <label
                  key={option.value}
                  className={`group flex cursor-pointer gap-4 rounded-[24px] border p-4 transition ${
                    checked
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="erp-page-navigation-mode"
                    value={option.value}
                    checked={checked}
                    onChange={() => applyMode(option.value)}
                    className="mt-1 h-4 w-4 accent-sky-600"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
                      <Icon className={checked ? "text-sky-700" : "text-slate-500"} />
                      {option.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>
    </ERPPage>
  );
}
