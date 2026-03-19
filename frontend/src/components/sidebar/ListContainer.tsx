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
    <div className="flex flex-col gap-0.5">
      {components &&
        components.map((Component, index) => {
          if(!Component) return null
          return (
            <div
              onMouseEnter={() => setHover({ id: index, state: true })}
              onMouseLeave={() => setHover({ id: -1, state: false })}
              onClick={() => {
                if (setSelected) {
                  setSelected(index);
                }
                if (onItemClick) {
                  onItemClick();
                }
              }}
              key={index}
              style={{
                backgroundColor:
                  hover && hover.id === index
                    ? s.color.hoverColor
                    : selected === index
                      ? s.color.hoverColor
                      : "",
                color: index === selected ? s.color.primary : "",
              }}
              className={`cursor-pointer text-[12px] rounded`}
            >
              {Component}
            </div>
          );
        })}
    </div>
  );
}

export default ListContainer;
