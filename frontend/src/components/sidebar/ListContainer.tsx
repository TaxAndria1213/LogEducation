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

  const activateItem = (component: ReactElement, index: number) => {
    setSelected?.(index);

    const componentOnClick =
      typeof component.props?.onClick === "function" ? component.props.onClick : undefined;

    componentOnClick?.();
    onItemClick?.();
  };

  return (
    <div className="flex flex-col gap-1">
      {components &&
        components.map((Component, index) => {
          if (!Component) return null;

          const active = selected === index;
          const hovered = hover.state && hover.id === index;

          return (
            <div
              onMouseEnter={() => setHover({ id: index, state: true })}
              onMouseLeave={() => setHover({ id: -1, state: false })}
              onClick={() => activateItem(Component, index)}
              key={index}
              style={{
                backgroundColor: hovered || active ? s.color.hoverColor : "",
                color: active ? s.color.primary : "",
                borderColor: active ? `${s.color.primary}20` : "transparent",
              }}
              className={`group cursor-pointer rounded-2xl border px-3 py-2.5 text-[12px] transition-all duration-150 ${
                active ? "shadow-sm" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="pointer-events-none min-w-0 flex-1">{Component}</div>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full transition ${
                    active ? "bg-sky-500" : hovered ? "bg-slate-300" : "bg-transparent"
                  }`}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default ListContainer;
