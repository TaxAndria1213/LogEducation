import type React from "react";
import { styles } from "../../styles/styles";

type Props = {
  icon: React.ReactNode;
  onClick?: () => void;
  w?: number; // ex: 40 ou "40px" ou "2.5rem"
  h?: number;
  size?: number;
};

function IconButton({ icon, w = 40, h = 40, onClick, size }: Props) {
  const style = styles;
  return (
    <button
      type="button"
      onClick={onClick}
      style={
        {
          width: size ? `${size}px` : w ? `${w}px` : "40px",
          height: size ? `${size}px` : h ? `${h}px` : "40px",
          borderRadius: style.rounded.xl,
        }
        
      }
      className="cursor-pointer flex items-center justify-center hover:bg-gray-100 border border-gray-200"
    >
      {icon}
    </button>
  );
}

export default IconButton;
