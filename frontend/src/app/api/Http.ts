/* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from 'axios'
import ErrorHandler from '../Error'
import { api, systemApi } from './axios'

export type BackendMessageType = "success" | "error";
type BackendMessageEntry = { message: string; timestamp: number };

const backendMessages: Partial<Record<BackendMessageType, BackendMessageEntry>> = {};
const BACKEND_MESSAGE_TTL_MS = 30000;

function extractBackendMessage(data: any) {
    const message =
        typeof data?.status?.error?.message === "string" && data.status.error.message.trim()
            ? data.status.error.message.trim()
            : typeof data?.status?.message === "string" && data.status.message.trim()
                ? data.status.message.trim()
                : typeof data?.message === "string" && data.message.trim()
                ? data.message.trim()
                : null;

    return message;
}

export function consumeBackendResponseMessage(type: BackendMessageType) {
    const entry = backendMessages[type];
    if (!entry) return null;

    const elapsed = Date.now() - entry.timestamp;
    if (elapsed > BACKEND_MESSAGE_TTL_MS) {
        delete backendMessages[type];
        return null;
    }

    const message = entry.message;
    delete backendMessages[type];
    return message;
}

export function consumeBackendSuccessMessage() {
    return consumeBackendResponseMessage("success");
}

export class Http {
    private static rememberMessage(type: BackendMessageType, data: any) {
        const message = extractBackendMessage(data);

        if (!message) return;

        backendMessages[type] = {
            message,
            timestamp: Date.now(),
        };
    }

    private static rememberSuccessMessage(data: any) {
        this.rememberMessage("success", data);
    }

    private static rememberErrorMessage(error: any) {
        this.rememberMessage("error", error?.response?.data ?? error);
    }

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
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async post(url: string, params: any) {
        try {
            const { data } = await api.post(url, params)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async patch(url: string, params: any) {
        try {
            const { data } = await api.patch(url, params)

            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async put(url: string, params: any) {
        try {
            const { data } = await api.put(url, params)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async delete(url: string) {
        try {
            const { data } = await api.delete(url)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
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
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async syspost(url: string, params: any) {
        try {
            const { data } = await systemApi.post(url, params)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async syspatch(url: string, params: any) {
        try {
            const { data } = await systemApi.patch(url, params)

            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async sysput(url: string, params: any) {
        try {
            const { data } = await systemApi.put(url, params)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }

    static async sysdelete(url: string) {
        try {
            const { data } = await systemApi.delete(url)
            if (data?.status?.success) {
                this.rememberSuccessMessage(data);
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status ?? new Error("La requete systeme a echoue.")
            }
        } catch (e) {
            const normalizedError = this.normalizeError(e);
            this.rememberErrorMessage(normalizedError);
            ErrorHandler.handle(normalizedError)
            throw normalizedError;
        }
    }
}
