import { useState } from "react";

function TableTooltip({ info, children }: { info: string, children?: React.ReactNode }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: "relative",
        display: "inline-block", // le wrapper prend la taille du contenu visible
        maxWidth: 150,
        verticalAlign: "top",
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: "default",
        }}
      >
        {children ? children : info}
      </div>

      {showTooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,

            backgroundColor: "white",
            color: "black",
            padding: "5px 8px",
            borderRadius: "3px",
            border: "1px solid black",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,

            whiteSpace: "nowrap", // ✅ largeur = taille du texte
            width: "max-content", // ✅ prend la largeur du contenu
            maxWidth: "none",
            opacity: 0.95,
            pointerEvents: "none", // évite les glitches au hover
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}

export default TableTooltip;