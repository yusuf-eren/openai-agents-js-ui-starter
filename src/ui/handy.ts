export function isHandoffToolName(name?: string) {
  return typeof name === 'string' && /^transfer_to_[\w-]+$/i.test(name);
}
