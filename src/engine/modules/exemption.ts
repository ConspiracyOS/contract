// src/engine/modules/exemption.ts
// Matches: // @contract:C-042:exempt:reason-text
// or:      # @contract:C-042:exempt:reason-text
const EXEMPTION_RE = (id: string) =>
  new RegExp(`(?://|#)\\s*@contract:${id}:exempt:(.+)`);

interface Exemption {
  reason: string;
}

export async function findExemption(
  filePath: string,
  contractId: string
): Promise<Exemption | null> {
  const content = await Bun.file(filePath).text();
  const match = EXEMPTION_RE(contractId).exec(content);
  if (!match) return null;
  const reason = match[1]!.trim();
  if (!reason) return null;
  return { reason };
}
