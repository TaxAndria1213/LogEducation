// src/components/Loading.tsx
import React from "react";
import "../../assets/css/loading.css";

interface LoadingProps {
  /** Message personnalisé à afficher sous le titre */
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ message = "Chargement..." }) => {
  return (
    <div className="erp-loading-container">
      <div className="erp-logo">
        <div className="erp-circle"></div>
        <div className="erp-circle erp-circle-delay"></div>
      </div>
      <p className="erp-subtitle">{message}</p>
    </div>
  );
};

export default Loading;
