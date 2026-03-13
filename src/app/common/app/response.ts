/* eslint-disable @typescript-eslint/no-explicit-any */
import {Response as R} from "express"

class Response {
  static success(res: R, message: string, data: any, payload = null) {
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
    res.status(code || 500).send({
      status: {
        code: code || 500,
        success: false,
        message: message,
        error: error,
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
