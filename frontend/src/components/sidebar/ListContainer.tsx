import { useState, type ReactElement } from "react";
import { styles } from "../../styles/styles";

type Props = {
  components: ReactElement[];
  selected?: number;
  setSelected?: (index: number) => void;
  onItemClick?: () => void;
};

function ListContainer({ components, selected, setSelected, onItemClick }: Props) {
  const [hover, setHover] = useState({ id: -1, state: false });
  const s = styles;

  return (
    <div className="flex flex-col gap-1.5">
      {components &&
        components.map((Component, index) => {
          if (!Component) return null;

          const active = selected === index;
          const hovered = hover.state && hover.id === index;

          return (
            <div
              onMouseEnter={() => setHover({ id: index, state: true })}
              onMouseLeave={() => setHover({ id: -1, state: false })}
              onClick={() => {
                setSelected?.(index);
                onItemClick?.();
              }}
              key={index}
              style={{
                backgroundColor: hovered || active ? s.color.hoverColor : "",
                color: active ? s.color.primary : "",
                borderColor: active ? `${s.color.primary}20` : "transparent",
              }}
              className="cursor-pointer rounded-2xl border px-1 py-1 text-[12px] transition-all duration-150"
            >
              {Component}
            </div>
          );
        })}
    </div>
  );
}

export default ListContainer;
