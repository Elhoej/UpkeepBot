export function formatName(name) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}
