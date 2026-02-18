// src/engine/modules/config.ts
import yaml from "js-yaml";

function getNestedValue(obj: unknown, key: string): unknown {
  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

interface KeyCheck {
  equals?: string;
  matches?: string;
  exists?: boolean;
}

function evaluateKeyCheck(value: unknown, check: KeyCheck): boolean {
  if (check.exists !== undefined) return check.exists ? value !== undefined : value === undefined;
  const str = String(value);
  if (check.equals !== undefined) return str === check.equals;
  if (check.matches !== undefined) return new RegExp(check.matches).test(str);
  return false;
}

export async function checkYamlKey(filePath: string, key: string, check: KeyCheck): Promise<boolean> {
  const content = await Bun.file(filePath).text();
  const parsed = yaml.load(content);
  return evaluateKeyCheck(getNestedValue(parsed, key), check);
}

export async function checkJsonKey(filePath: string, key: string, check: KeyCheck): Promise<boolean> {
  const content = await Bun.file(filePath).text();
  const parsed = JSON.parse(content);
  return evaluateKeyCheck(getNestedValue(parsed, key), check);
}

export async function checkTomlKey(_filePath: string, _key: string, _check: KeyCheck): Promise<boolean> {
  throw new Error("toml_key: TOML parsing not yet implemented");
}
