// 文件存储处理
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const ROOT = path.resolve(process.cwd(), config.fs.publicRoot);

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

export function fsPath(relPath) {
  const full = path.join(ROOT, relPath);
  if (!full.startsWith(ROOT + path.sep) && full !== ROOT) {
    throw new Error('非法路径');
  }
  return full;
}

export async function fileExists(relPath) {
  try {
    await fs.access(fsPath(relPath));
    return true;
  } catch {
    return false;
  }
}

/** 内容按 md5 命名落盘，返回相对路径 */
export async function putFile(dir, data, ext) {
  const name = `md5_${md5(data)}.${ext}`;
  const rel = path.posix.join(dir, name);
  await fs.mkdir(path.dirname(fsPath(rel)), { recursive: true });
  await fs.writeFile(fsPath(rel), data);
  return rel;
}

/** 头像转存：从 tmp 目录移动到 image 目录 */
export async function moveTmpToImage(srcRel) {
  const data = await fs.readFile(fsPath(srcRel));
  const rel = await putFile('image', data, path.extname(srcRel).replace(/^\./, '') || 'jpg');
  await fs.unlink(fsPath(srcRel));
  return rel;
}
