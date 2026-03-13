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
  return (
    <div
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      className={`fixed top-0 left-0 w-full h-full flex items-center justify-center z-50 ${isOpen ? "block" : "hidden"}`}
    >
      <head className="fixed top-0 left-0 w-full h-full">
        <Title1 title={title || ""}></Title1>
        {/**icon de fermeture du popup */}
        <button
          className="absolute top-4 right-4 text-white text-2xl font-bold"
          onClick={() => setIsOpen(false)}
        >
          &times;
        </button>
      </head>

      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
}

export default FlyPopup;
