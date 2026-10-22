import { simpleGit } from 'simple-git'
import { compareVersions } from '../version'
import { tagToVersion } from './github'

export interface LatestTag {
  /** The tag, as named upstream */
  tag: string
  /** The PKGBUILD version for the tag */
  version: string
}

/** Git environment that fails instead of prompting for credentials. */
export function gitEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }
  return { ...env, GIT_TERMINAL_PROMPT: '0' }
}

/**
 * Lists the tags of a git repository, whatever the host.
 *
 * @param url - The repository URL
 */
export async function listGitTags(url: string): Promise<string[]> {
  const output = await simpleGit()
    .env(gitEnv())
    .listRemote(['--tags', '--refs', url])

  return output
    .split('\n')
    .map(line => line.split('\t')[1])
    .filter((ref): ref is string => Boolean(ref))
    .map(ref => ref.replace(/^refs\/tags\//, ''))
}

/**
 * Picks the highest version among the tags that match `tagRegex`.
 *
 * @param tags - The tags to choose from
 * @param tagRegex - Only consider tags matching this regex
 * @param versionRegex - Regex whose first capture group is the version within
 *   a tag (e.g. `^(\d+\.\d+\.\d+)-alt\d+$`); tags that don't match are ignored
 * @throws {Error} If no tag matches
 */
export function selectLatestTag(
  tags: string[],
  tagRegex?: string,
  versionRegex?: string
): LatestTag {
  const tagMatcher = tagRegex ? new RegExp(tagRegex) : undefined
  const versionMatcher = versionRegex ? new RegExp(versionRegex) : undefined
  let best: { tag: string; key: string } | undefined

  for (const tag of tags) {
    if (tagMatcher && !tagMatcher.test(tag)) {
      continue
    }

    let key = tag
    if (versionMatcher) {
      const match = versionMatcher.exec(tag)
      if (!match?.[1]) {
        continue
      }
      key = match[1]
    }

    // Compare by version first and by the whole tag on a tie (e.g. -alt1 < -alt2)
    const order = best ? compareVersions(key, best.key) : 1
    if (
      !best ||
      order > 0 ||
      (order === 0 && compareVersions(tag, best.tag) > 0)
    ) {
      best = { tag, key }
    }
  }

  if (!best) {
    throw new Error(
      `No tags matching ${[tagRegex, versionRegex].filter(Boolean).join(' / ') || 'any pattern'}`
    )
  }

  return { tag: best.tag, version: tagToVersion(best.key) }
}

/**
 * Finds the latest version of a git repository from its tags.
 *
 * @param url - The repository URL
 * @param tagRegex - Only consider tags matching this regex
 * @param versionRegex - Regex whose first capture group is the version within a tag
 */
export async function findLatestGitTag(
  url: string,
  tagRegex?: string,
  versionRegex?: string
): Promise<LatestTag> {
  try {
    return selectLatestTag(await listGitTags(url), tagRegex, versionRegex)
  } catch (error) {
    throw new Error(
      `Failed to find the latest tag of ${url}: ${error instanceof Error ? error.message : error}`
    )
  }
}
