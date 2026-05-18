import { Link } from "react-router-dom";
import type { NavigationModule } from "./modules.config";

type ModuleCardProps = {
  module: NavigationModule;
};

export default function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Link
      to={module.defaultPath}
      className="group flex w-24 flex-col items-center gap-3 text-center outline-none"
      title={module.description}
    >
      <div className="relative">
        <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-gradient-to-br from-slate-900 to-slate-700 text-2xl text-white shadow-[0_10px_22px_rgba(15,23,42,0.22)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-sky-100">
          {module.icon}
        </div>
        {module.badge ? (
          <span className="absolute -right-2 -top-2 h-3 w-3 rounded-full border-2 border-white bg-sky-500" />
        ) : null}
      </div>

      <span className="line-clamp-2 text-[13px] font-semibold leading-4 text-slate-700 transition group-hover:text-slate-950">
        {module.title}
      </span>
    </Link>
  );
}
