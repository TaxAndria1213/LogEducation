type AccessContainerProps = {
  id: string;
  access: boolean;
  onClick?: () => void;
  optionsStyle?: React.CSSProperties;
  children: React.ReactNode;
};

function AccessContainer({
  id,
  access,
  optionsStyle,
  onClick,
  children,
}: AccessContainerProps) {
  if (!access) return null;
  return (
    <div
      key={id}
      onClick={onClick}
      className="pointor-cursor"
      style={{
        ...(optionsStyle ?? {}),
      }}
    >
      {children}
    </div>
  );
}

export default AccessContainer;
