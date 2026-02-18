// src/engine/modules/filesystem.ts
import { stat } from "fs/promises";

export async function checkPathExists(
  filePath: string,
  type?: "file" | "directory"
): Promise<boolean> {
  try {
    const s = await stat(filePath);
    if (!type) return true;
    if (type === "file") return s.isFile();
    if (type === "directory") return s.isDirectory();
    return false;
  } catch {
    return false;
  }
}

export async function checkPathNotExists(filePath: string): Promise<boolean> {
  return !(await checkPathExists(filePath));
}
