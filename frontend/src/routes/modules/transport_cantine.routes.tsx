import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faBus } from "@fortawesome/free-solid-svg-icons";

export const transport_cantine: menu = {
  key: "transport_cantine",
  name: "Transport & cantine",
  icon: <FontAwesomeIcon icon={faBus} />,
  submodules: [
    {
      key: "transport",
      name: "Transport",
      path: "/transport_cantine/transport",
    },
    {
      key: "cantine",
      name: "Cantine",
      path: "/transport_cantine/cantine",
    },
  ],
};
