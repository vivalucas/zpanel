/** Navigation permits web and relative URLs, never script/data/file schemes. */
export function isSafeNavigationUrl(value: string): boolean {
  if (!value || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '\\'))
    return false
  try {
    const url = new URL(value.trim(), 'https://zpanel.invalid/')
    return url.protocol === 'https:' || url.protocol === 'http:'
  }
  catch {
    return false
  }
}
