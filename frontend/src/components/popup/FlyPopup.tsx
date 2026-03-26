import Title1 from "../text/Title1";

function FlyPopup({
  isOpen,
  setIsOpen,
  title,
  children,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  title?: string;
  children?: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="Fermer le popup"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <Title1 title={title} /> : <div />}
        <button
          type="button"
          className="text-2xl font-bold text-slate-500 transition hover:text-slate-900"
          onClick={() => setIsOpen(false)}
        >
          &times;
        </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default FlyPopup;
