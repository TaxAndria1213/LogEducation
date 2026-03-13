/* eslint-disable @typescript-eslint/no-explicit-any */
// import axios from 'axios'
import ErrorHandler from '../Error'
import { api, systemApi } from './axios'

export class Http {

    static async get(url: string, params: any) {
        try {
            const { data } = await api.get(url, {
                params: { ...params, timestamp: new Date().getTime() }
            })

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async post(url: string, params: any) {
        try {
            const { data } = await api.post(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async patch(url: string, params: any) {
        try {
            const { data } = await api.patch(url, params)

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async put(url: string, params: any) {
        try {
            const { data } = await api.put(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async delete(url: string) {
        try {
            const { data } = await api.delete(url)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
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
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async syspost(url: string, params: any) {
        try {
            const { data } = await systemApi.post(url, params)
            console.log("🚀 ~ Http ~ syspost ~ data:", data)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async syspatch(url: string, params: any) {
        try {
            const { data } = await systemApi.patch(url, params)

            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async sysput(url: string, params: any) {
        try {
            const { data } = await systemApi.put(url, params)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }

    static async sysdelete(url: string) {
        try {
            const { data } = await systemApi.delete(url)
            if (data?.status?.success) {
                return { status: data?.status, data: data?.data }
            } else {
                throw data?.status
            }
        } catch (e) {
            ErrorHandler.handle(e)
        }
    }
}
