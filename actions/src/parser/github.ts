import { Octokit } from 'octokit'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

export async function findLatestGitHub(repo: string): Promise<string> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: { fetch: _fetch }
  })

  const { data } = await octokit.rest.repos.getLatestRelease({
    owner: repo.split('/')[0],
    repo: repo.split('/')[1]
  })

  // Some repositories prefix tags with a leading 'v' (e.g. "v1.2.3").
  // Strip a single leading 'v' so the version can be used directly
  // in filenames that don't include the prefix.
  return data.tag_name.replace(/^v/, '')
}
