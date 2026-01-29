import { Octokit } from 'octokit'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

export async function findLatestGitHub(repo: string): Promise<string> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: { fetch: _fetch }
  })

  let releaseData

  try {
    const { data } = await octokit.rest.repos.getLatestRelease({
      owner: repo.split('/')[0],
      repo: repo.split('/')[1]
    })
    releaseData = data
  } catch (error: any) {
    if (error.status === 404) {
      const { data: releases } = await octokit.rest.repos.listReleases({
        owner: repo.split('/')[0],
        repo: repo.split('/')[1],
        per_page: 1
      })

      if (releases.length > 0) {
        releaseData = releases[0]
      } else {
        // Fallback to tags if no releases are found
        const { data: tags } = await octokit.rest.repos.listTags({
          owner: repo.split('/')[0],
          repo: repo.split('/')[1],
          per_page: 1
        })

        if (tags.length === 0) {
          throw new Error(`No releases or tags found for repo ${repo}`)
        }
        // Construct a minimal releaseData object from the tag
        releaseData = { tag_name: tags[0].name }
      }
    } else {
      throw error
    }
  }

  // Some repositories prefix tags with a leading 'v' (e.g. "v1.2.3").
  // Strip a single leading 'v' so the version can be used directly
  // in filenames that don't include the prefix.
  // Also replace '-' with '_' to comply with Arch Linux pkgver standards.
  return releaseData.tag_name.replace(/^v/, '').replace(/-/g, '_')
}
