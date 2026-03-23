import { useCallback, useEffect, useMemo, useState } from "react";
import ReferencielService, {
  type ReferentialCatalogItem,
} from "../../../../services/referenciel.service";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Le catalogue des referentiels n'a pas pu etre charge.";
}

export function useReferentialCatalog() {
  const service = useMemo(() => new ReferencielService(), []);
  const [rows, setRows] = useState<ReferentialCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await service.getCatalog();
      setRows(
        result?.status.success
          ? ((result.data as ReferentialCatalogItem[]) ?? [])
          : [],
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    rows,
    loading,
    errorMessage,
    reload,
    service,
  };
}
