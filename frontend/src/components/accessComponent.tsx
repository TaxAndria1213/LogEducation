/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSX } from "react";
import type { ComponentIdentifierType } from "./components.build";
import AccessContainer from "./container/AccessContainer";

type CompFn = ComponentIdentifierType["component"];

export const withAccess =
  (
    render: (optionsStyle: any) => React.ReactNode,
    extraStyle?: React.CSSProperties,
  ): CompFn =>
  (id, access, optionsStyle, onClick) => (
    <AccessContainer
      id={id}
      access={access}
      onClick={onClick}
      optionsStyle={{ ...extraStyle, ...optionsStyle }}
    >
      {render(optionsStyle)}
    </AccessContainer>
  );

export const menuItem = (
  Icon?: React.ComponentType<any>,
  label?: string,
  component?: JSX.Element,
): CompFn =>
  withAccess(
    () => (
      <div className="flex items-center py-0.5 px-2 gap-[5px]">
        {Icon && <Icon />}
        {label && <span>{label}</span>}
        {component}
      </div>
    ),
    { display: "flex", alignItems: "center", gap: "5px" },
  );