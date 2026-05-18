type PreloadPageProps = {
  message?: string;
};

export default function PreloadPage({
  message = "Preparation de votre espace LogESco...",
}: PreloadPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 py-10 text-slate-800">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-sky-100 blur-2xl" />
        <div className="absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-emerald-100 blur-2xl" />

        {/* <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-900 text-white shadow-lg shadow-slate-200">
          <div className="absolute h-20 w-20 animate-ping rounded-[28px] bg-sky-300/20" />
          <span className="text-2xl font-black tracking-tight">LE</span>
        </div> */}

        <div className="relative mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Chargement
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">
            LogESco se prepare
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        </div>

        <div className="relative mt-7 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-[preload-slide_1.2s_ease-in-out_infinite] rounded-full bg-sky-500" />
        </div>
      </div>
    </div>
  );
}
