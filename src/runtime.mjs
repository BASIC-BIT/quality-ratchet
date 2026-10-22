export function supportsNodeVersion(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return major === 24 && (minor > 22 || (minor === 22 && patch >= 1));
}
