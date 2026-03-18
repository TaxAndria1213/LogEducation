import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { UtilisateurRole } from "../types/models";

class UtilisateurRoleService extends Service {
    constructor() {
        super("roles_user");
    }

    async createAssignment(data: Partial<UtilisateurRole>) {
        return await this.create(data);
    }

    async getAssignment(utilisateurId: string, roleId: string) {
        return await Http.get(`/api/roles_user/${utilisateurId}/${roleId}`, {});
    }

    async updateAssignment(utilisateurId: string, roleId: string, data: Partial<UtilisateurRole>) {
        return await Http.put(`/api/roles_user/${utilisateurId}/${roleId}`, data);
    }

    async deleteAssignment(utilisateurId: string, roleId: string) {
        return await Http.delete(`/api/roles_user/${utilisateurId}/${roleId}`);
    }
}

export default UtilisateurRoleService
