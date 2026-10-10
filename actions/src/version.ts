/**
 * A minimal "semver-like" version comparator.
 *
 * A single leading 'v' is stripped and the remainder is split on '.', '_' and
 * '-'. Numeric parts are compared numerically and anything else as a string.
 * This covers the tag shapes used by the configured repositories (e.g. 4.3.4,
 * 1.10.6, 6.2640.1) without pulling in a semver dependency.
 */
export function versionParts(version: string): (number | string)[] {
  return version
    .replace(/^v/, '')
    .split(/[._-]/)
    .map(part => (/^\d+$/.test(part) ? Number(part) : part))
}

/**
 * Returns a negative number when `a` is older than `b`, a positive number when
 * `a` is newer, and 0 when they are equal.
 */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a)
  const right = versionParts(b)
  const length = Math.max(left.length, right.length)

  for (let i = 0; i < length; i++) {
    const x = left[i]
    const y = right[i]

    if (x === y) {
      continue
    }
    if (x === undefined) {
      return -1
    }
    if (y === undefined) {
      return 1
    }
    if (typeof x === 'number' && typeof y === 'number') {
      return x < y ? -1 : 1
    }
    return String(x) < String(y) ? -1 : 1
  }

  return 0
}
