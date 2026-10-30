/** Compare against the registered/current confirmed body, not the AI draft. */
export function hasRequirementChanges(source, finalContent) {
  const normalize = value => value.replace(/\r\n?/g, '\n');
  return normalize(source) !== normalize(finalContent);
}
