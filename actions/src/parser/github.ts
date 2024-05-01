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

  return data.tag_name
}
