import PreloadPage from "../../pages/PreloadPage";

type LoadingProps = {
  message?: string;
};

export default function Loading({ message = "Chargement..." }: LoadingProps) {
  return <PreloadPage message={message} />;
}
