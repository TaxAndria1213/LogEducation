import { Form } from "../../../../../components/Form/Form";
import EtablissementService from "../../../../../services/etablissement.service";
import {
  etablissementFields,
  etablissementSchema,
} from "./schema/EtablissementSchemas";

function EtablissementForm() {
  const service = new EtablissementService();
  return (
    <div className="w-[100%]">
      <Form
        schema={etablissementSchema}
        fields={etablissementFields}
        service={service}
        labelMessage={"Etablissement"}
      />
    </div>
  );
}

export default EtablissementForm;
