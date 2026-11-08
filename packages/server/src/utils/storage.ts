// 文件存储（对应 think-filesystem 的 public 磁盘：root = public/storage，URL = /storage）
// putFile($dir, $file, 'md5') 的命名规则实现为 `${dir}/md5_${md5(file)}.${ext}`
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {config} from '../config.js';

const ROOT = path.resolve(process.cwd(), config.fs.publicRoot);

function md5(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}

/** 磁盘内绝对路径 */
export function fsPath(relPath: string): string {
  const full = path.join(ROOT, relPath);
  if (!full.startsWith(ROOT + path.sep) && full !== ROOT) {
    throw new Error('非法路径');
  }
  return full;
}

export async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(fsPath(relPath));
    return true;
  } catch {
    return false;
  }
}

/** putFile($dir, $file, 'md5') —— 内容按 md5 命名落盘，返回相对路径 */
export async function putFile(dir: string, data: Buffer, ext: string): Promise<string> {
  const name = `md5_${md5(data)}.${ext}`;
  const rel = path.posix.join(dir, name);
  await fs.mkdir(path.dirname(fsPath(rel)), {recursive: true});
  await fs.writeFile(fsPath(rel), data);
  return rel;
}

/** 头像转存：tmp 文件移动到 image 目录并按 md5 命名，删除源文件（对应 LoginController::profile） */
export async function moveTmpToImage(srcRel: string): Promise<string> {
  const data = await fs.readFile(fsPath(srcRel));
  const rel = await putFile('image', data, path.extname(srcRel).replace(/^\./, '') || 'jpg');
  await fs.unlink(fsPath(srcRel));
  return rel;
}

export async function deleteFile(relPath: string): Promise<void> {
  await fs.unlink(fsPath(relPath));
}
