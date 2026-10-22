import { Octokit } from 'octokit'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

/**
 * Converts a git tag to a PKGBUILD version.
 *
 * Some repositories prefix tags with a leading 'v' (e.g. "v1.2.3").
 * Strip a single leading 'v' so the version can be used directly
 * in filenames that don't include the prefix.
 * Also replace '-' with '_' to comply with Arch Linux pkgver standards.
 */
export function tagToVersion(tagName: string): string {
  return tagName.replace(/^v/, '').replace(/-/g, '_')
}

type Release = Awaited<
  ReturnType<Octokit['rest']['repos']['listReleases']>
>['data'][number]

function isStable(release: Release): boolean {
  return !release.draft && !release.prerelease
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  )
}

/**
 * Finds the git tag of the latest version, as named upstream.
 *
 * @param repo - The repository, as `owner/repo`
 * @param tagRegex - Only consider releases/tags matching this regex
 */
export async function findLatestGitHubTag(
  repo: string,
  tagRegex?: string
): Promise<string> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: { fetch: _fetch }
  })
  const [owner, name] = repo.split('/')
  const regex = tagRegex ? new RegExp(tagRegex) : undefined

  const { data: releases } = await octokit.rest.repos.listReleases({
    owner,
    repo: name,
    per_page: 100
  })

  let validRelease: { tag_name: string } | undefined

  if (regex) {
    validRelease = releases.find(
      release => regex.test(release.tag_name) && isStable(release)
    )
  } else {
    // Try to fetch the latest release directly if no regex is provided
    try {
      const { data } = await octokit.rest.repos.getLatestRelease({
        owner,
        repo: name
      })
      validRelease = data
    } catch (error) {
      if (!isNotFound(error)) {
        throw error
      }
      validRelease = releases.find(isStable)
    }
  }

  if (validRelease) {
    return validRelease.tag_name
  }

  // Fallback to tags if no releases match
  const { data: tags } = await octokit.rest.repos.listTags({
    owner,
    repo: name,
    per_page: 100
  })
  const validTag = regex ? tags.find(tag => regex.test(tag.name)) : tags[0]

  if (!validTag) {
    throw new Error(
      `No releases or tags found for repo ${repo} matching criteria`
    )
  }

  return validTag.name
}
