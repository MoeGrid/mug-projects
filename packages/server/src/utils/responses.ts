// 统一响应与异常（对应老项目 json(['code'=>1,'data'=>...]) 与 ExceptionHandle）
import {HTTPException} from 'hono/http-exception';

/**
 * 业务异常：等价老项目 throw new Exception(...)。
 * 由 onError 统一转成 HTTP 200 + {code:0, msg}（对齐小程序 _ajax：仅 200 才读 code/msg）。
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** json(['code' => 1, 'data' => $data]) */
export function ok(data: unknown) {
  return {code: 1, data};
}

/** 分页结果（近似 ThinkPHP paginator 的 JSON 结构） */
export function paginateData<T>(items: T[], total: number, rows: number, page: number) {
  return {
    total,
    per_page: rows,
    current_page: page,
    last_page: Math.max(Math.ceil(total / rows), 1),
    data: items,
  };
}

export {HTTPException};
