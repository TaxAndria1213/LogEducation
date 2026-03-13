/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import PrismaService from "./prisma_service";

class Service {
    private prisma: PrismaService;
    constructor(private modelName: keyof PrismaClient) {
        this.prisma = new PrismaService(this.modelName);
    }

    create(data: any) {
        return this.prisma.create(data);
    }

    findUnique(id: number) {
        return this.prisma.findUnique(id);
    }

    findMany() {
        return this.prisma.findMany();
    }

    update(id: number, data: any) {
        return this.prisma.update(id, data);
    }

    delete(id: number) {
        return this.prisma.delete(id);
    }

    findByCondition(where: object) {
        return this.prisma.findByCondition(where);
    }


}

export default Service;