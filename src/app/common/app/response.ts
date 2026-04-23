/* eslint-disable @typescript-eslint/no-explicit-any */
import {Response as R} from "express"

class Response {
  private static getErrorMetadata(error?: Error) {
    if (!error) return undefined;

    const errorWithCode = error as Error & { code?: string | number };
    const details: Record<string, unknown> = {
      name: error.name,
    };

    if (typeof errorWithCode.code === "string" || typeof errorWithCode.code === "number") {
      details.code = errorWithCode.code;
    }

    if (process.env.NODE_ENV === "development") {
      details.message = error.message;
      details.stack = error.stack;
    }

    return details;
  }

  static success(res: R, message: string, data: any, payload: any = null) {
    if (payload) {
      // payload = {
      //   page: pagination.page + 1,
      //   limit: pagination.limit,
      //   from: data.length <= 0 ? 0 : pagination.page * pagination.limit + 1,
      //   to:
      //     data.length <= 0
      //       ? 0
      //       : data.length < pagination.limit
      //       ? pagination.page * pagination.limit + data.length
      //       : pagination.page * pagination.limit + pagination.limit,
      //   totalCount: eCount,
      //   pages: generatePages({
      //     page: pagination.page,
      //     limit: pagination.limit,
      //     totalCount: eCount,
      //   }),
      // };
      res.status(200).send({
        status: {
          code: 200,
          success: true,
          message: message,
        },
        data: this.isIterable(data) ? [...data] : data,
        payload: payload,
      });
    } else {
      res.status(200).send({
        status: {
          code: 200,
          success: true,
          message: message,
        },
        data: this.isIterable(data) ? [...data] : data,
      });
    }
  }

  static successFile(res: R, data: any) {
    res.setHeader('Content-Disposition', 'attachment; filename=badges.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200);
    res.end(data);
  }

  static successToken(res: R, message: string, data: any) {

      res.status(200).send({
        status: {
          code: 200,
          success: true,
          message: message,
        },
        data: data,
      });
  
  }

  static error(res: R, message: string, code: number, error: Error) {
    const errorMetadata = this.getErrorMetadata(error);
    res.status(code || 500).send({
      message: message,
      status: {
        code: code || 500,
        success: false,
        message: message,
        ...(errorMetadata ? { error: errorMetadata } : {}),
      },
      data: null,
    });
  }
  
  static isIterable(obj: any) {
    // checks for null and undefined
    if (obj == null) {
      return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
  }
}

export default Response;
