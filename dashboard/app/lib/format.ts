const TOKEN_MILLION = 1_000_000;
const TOKEN_THOUSAND = 1_000;

export function formatTokens(tokens: number): string {
  if (tokens >= TOKEN_MILLION) {
    return `${(tokens / TOKEN_MILLION).toFixed(1)}M`;
  }
  if (tokens >= TOKEN_THOUSAND) {
    return `${(tokens / TOKEN_THOUSAND).toFixed(1)}K`;
  }
  return String(tokens);
}
