import { Octokit } from 'octokit'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

export async function findLatestGitHub(
  repo: string,
  tagRegex?: string
): Promise<string> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: { fetch: _fetch }
  })

  let releaseData

  try {
    const { data: releases } = await octokit.rest.repos.listReleases({
      owner: repo.split('/')[0],
      repo: repo.split('/')[1],
      per_page: 100
    })

    let validRelease

    if (tagRegex) {
      const regex = new RegExp(tagRegex)
      validRelease = releases.find((r: any) => regex.test(r.tag_name) && !r.draft && !r.prerelease)
    } else {
      // Fallback: try to fetch latest release directly if no regex is provided
      try {
        const { data } = await octokit.rest.repos.getLatestRelease({
          owner: repo.split('/')[0],
          repo: repo.split('/')[1]
        })
        validRelease = data
      } catch (err: any) {
        if (err.status === 404) {
           validRelease = releases.find((r: any) => !r.draft && !r.prerelease)
        } else {
           throw err
        }
      }
    }

    if (validRelease) {
      releaseData = validRelease
    } else {
      // Fallback to tags if no releases match
      const { data: tags } = await octokit.rest.repos.listTags({
        owner: repo.split('/')[0],
        repo: repo.split('/')[1],
        per_page: 100
      })

      let validTag
      if (tagRegex) {
        const regex = new RegExp(tagRegex)
        validTag = tags.find((t: any) => regex.test(t.name))
      } else {
        validTag = tags[0]
      }

      if (!validTag) {
        throw new Error(`No releases or tags found for repo ${repo} matching criteria`)
      }
      releaseData = { tag_name: validTag.name }
    }
  } catch (error: any) {
    throw error
  }

  // Some repositories prefix tags with a leading 'v' (e.g. "v1.2.3").
  // Strip a single leading 'v' so the version can be used directly
  // in filenames that don't include the prefix.
  // Also replace '-' with '_' to comply with Arch Linux pkgver standards.
  return releaseData.tag_name.replace(/^v/, '').replace(/-/g, '_')
}
