// TODO(you): scope enforcement. Granted = requested ∩ consented; checks are exact.
export function grantedScopes(requested: string[], consented: string[]): string[] {
  void requested; void consented;
  return []; // TODO
}

export function hasScope(granted: string[], required: string): boolean {
  void granted; void required;
  return false; // TODO
}

export function hasAllScopes(granted: string[], required: string[]): boolean {
  void granted; void required;
  return false; // TODO
}
