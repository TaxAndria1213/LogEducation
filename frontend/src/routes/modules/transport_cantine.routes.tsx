import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faBus } from "@fortawesome/free-solid-svg-icons";
import TransportIndex from "../../pages/transport_cantine/transport/TransportIndex";
import CantineIndex from "../../pages/transport_cantine/cantine/CantineIndex";

export const transport_cantine: menu = {
  key: "transport_cantine",
  name: "Transport & cantine",
  icon: <FontAwesomeIcon icon={faBus} />,
  submodules: [
    {
      key: "transport",
      name: "Transport",
      path: "/transport_cantine/transport",
      elements: <TransportIndex />,
    },
    {
      key: "cantine",
      name: "Cantine",
      path: "/transport_cantine/cantine",
      elements: <CantineIndex />,
    },
  ],
};
