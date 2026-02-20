// src/engine/types.ts

export type ContractType = "atomic" | "holistic";
export type ContractTrigger = "commit" | "pr" | "merge" | "schedule";
export type OnFail = "fail" | "require_exemption" | "warn";

export interface ContractScope {
  paths?: string[];
  exclude?: string[];
}

export interface SkipIf {
  env_var_unset?: string;
  path_not_exists?: string;
  not_in_ci?: boolean;
  command_not_available?: string;
}

// --- Check module types ---

export interface RegexInFileCheck {
  regex_in_file: { pattern: string };
}
export interface NoRegexInFileCheck {
  no_regex_in_file: { pattern: string };
}
export interface PathExistsCheck {
  path_exists: { path: string; type?: "file" | "directory" };
}
export interface PathNotExistsCheck {
  path_not_exists: { path: string };
}
export interface YamlKeyCheck {
  yaml_key: { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
}
export interface TomlKeyCheck {
  toml_key: { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
}
export interface JsonKeyCheck {
  json_key: { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
}
export interface EnvVarCheck {
  env_var: { name: string; equals?: string; matches?: string };
}
export interface NoEnvVarCheck {
  no_env_var: { name: string; matches?: string };
}
export interface CommandAvailableCheck {
  command_available: { name: string };
}
export interface CommandCheck {
  command: { run: string; exit_code?: number; output_matches?: string };
}
export interface ScriptCheck {
  script: { path: string; timeout?: string };
}
export interface AstGrepCheck {
  ast_grep: { rule: string };
}

export type CheckModule =
  | RegexInFileCheck
  | NoRegexInFileCheck
  | PathExistsCheck
  | PathNotExistsCheck
  | YamlKeyCheck
  | TomlKeyCheck
  | JsonKeyCheck
  | EnvVarCheck
  | NoEnvVarCheck
  | CommandAvailableCheck
  | CommandCheck
  | ScriptCheck
  | AstGrepCheck;

export interface ContractCheck {
  name: string;
  on_fail?: OnFail;
  skip_if?: SkipIf;
}

export type Check = ContractCheck & CheckModule;

export interface Contract {
  id: string;
  description: string;
  type: ContractType;
  trigger: ContractTrigger;
  scope: ContractScope | "global";
  skip_if?: SkipIf;
  checks: Check[];
}

// --- Result types ---

export type CheckStatus = "pass" | "fail" | "exempt" | "skip" | "warn";

export interface Finding {
  ruleId: string;
  message: string;
  severity: "error" | "warning" | "info";
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export type ModuleResult =
  | { pass: boolean; reason?: string }
  | { pass: boolean; reason?: string; findings: Finding[] };

export interface CheckResult {
  contractId: string;
  contractDescription: string;
  checkName: string;
  status: CheckStatus;
  message?: string;
  file?: string;
  findings?: Finding[];
}

export interface AuditResult {
  results: CheckResult[];
  passed: number;
  failed: number;
  exempt: number;
  skipped: number;
  warned: number;
  totalFindings?: number;
}
