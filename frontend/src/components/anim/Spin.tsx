import React from "react";

type SpinProps = {
  /** Taille du spinner en px */
  size?: number;
  /** Épaisseur du trait en px */
  thickness?: number;
  /** Texte d’accessibilité (et optionnellement visible) */
  label?: string;
  /** Afficher le label sous le spinner */
  showLabel?: boolean;
  /** Centrer le spinner dans son conteneur */
  center?: boolean;
  /** Spinner en ligne (inline-flex) */
  inline?: boolean;
  /** Classe CSS optionnelle */
  className?: string;
};

function Spin({
  size = 20,
  thickness = 2,
  label = "Chargement…",
  showLabel = false,
  center = false,
  inline = false,
  className,
}: SpinProps) {
  const wrapperStyle: React.CSSProperties = {
    display: inline ? "inline-flex" : "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...(center ? { width: "100%", minHeight: 48 } : null),
  };

  const spinnerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: thickness,
    // Couleurs basiques sans dépendre d'un thème
    borderColor: "rgba(0,0,0,0.15)",
    borderTopColor: "rgba(0,0,0,0.65)",
    animation: "spin 0.8s linear infinite",
    flex: "0 0 auto",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.85,
    lineHeight: 1.2,
  };

  return (
    <div
      className={className}
      style={wrapperStyle}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* CSS keyframes local */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={spinnerStyle} aria-hidden="true" />

      {showLabel ? <span style={labelStyle}>{label}</span> : null}
    </div>
  );
}

export default Spin;
