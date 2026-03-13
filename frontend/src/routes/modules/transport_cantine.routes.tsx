import type { menu } from "../../types/types";

export const transport_cantine: menu = {
  key: "transport_cantine",
  name: "Transport & cantine",
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
