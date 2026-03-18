/* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from 'axios'
import ErrorHandler from '../Error'
import { api, systemApi } from './axios'

export class Http {
    private static normalizeError(error: any) {
        if (error?.response) return error;

        const code = error?.code ?? error?.status?.code ?? 400;
        const message = error?.message ?? error?.status?.message ?? "Une erreur est survenue.";

        return {
            ...error,
            response: {
                status: code,
                data: {
                    message,
                    status: {
                        code,
                        success: false,
                        message,
                    },
                },
            },
        };
    }

    static async get(url: string, params: any) {
        try {
            const { data } = await api.get(url, {
                params: { ...params, timestamp: new Date().getTime() }
            })

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async post(url: string, params: any) {
        try {
            const { data } = await api.post(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async patch(url: string, params: any) {
        try {
            const { data } = await api.patch(url, params)

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async put(url: string, params: any) {
        try {
            const { data } = await api.put(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async delete(url: string) {
        try {
            const { data } = await api.delete(url)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async sysget(url: string, params: any) {
        try {
            const { data } = await systemApi.get(url, {
                params: { ...params, timestamp: new Date().getTime() }
            })

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async syspost(url: string, params: any) {
        try {
            const { data } = await systemApi.post(url, params)
            console.log("🚀 ~ Http ~ syspost ~ data:", data)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async syspatch(url: string, params: any) {
        try {
            const { data } = await systemApi.patch(url, params)

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async sysput(url: string, params: any) {
        try {
            const { data } = await systemApi.put(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async sysdelete(url: string) {
        try {
            const { data } = await systemApi.delete(url)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }
}
