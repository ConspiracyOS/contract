// src/engine/modules/regex.ts
export async function checkRegexInFile(filePath: string, pattern: string): Promise<boolean> {
  const content = await Bun.file(filePath).text();
  return new RegExp(pattern).test(content);
}

export async function checkNoRegexInFile(filePath: string, pattern: string): Promise<boolean> {
  return !(await checkRegexInFile(filePath, pattern));
}
