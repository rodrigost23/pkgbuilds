import { findLatestGitHubTag, tagToVersion } from '../src/parser/github'

const listReleases = jest.fn()
const getLatestRelease = jest.fn()
const listTags = jest.fn()

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: { repos: { listReleases, getLatestRelease, listTags } }
  }))
}))

const release = (
  tag_name: string,
  flags: { draft?: boolean; prerelease?: boolean } = {}
): { tag_name: string; draft: boolean; prerelease: boolean } => ({
  tag_name,
  draft: false,
  prerelease: false,
  ...flags
})

describe('tagToVersion', () => {
  it('should strip a single leading v and replace dashes', () => {
    expect(tagToVersion('v1.2.3')).toBe('1.2.3')
    expect(tagToVersion('1.5.1-beta6')).toBe('1.5.1_beta6')
    expect(tagToVersion('vv1')).toBe('v1')
  })
})

describe('findLatestGitHubTag', () => {
  beforeEach(() => {
    listReleases.mockReset()
    getLatestRelease.mockReset()
    listTags.mockReset()
    listReleases.mockResolvedValue({ data: [] })
    listTags.mockResolvedValue({ data: [] })
  })

  it('should use the latest release when there is no tag_regex', async () => {
    getLatestRelease.mockResolvedValue({ data: release('v2.0.0') })

    expect(await findLatestGitHubTag('owner/repo')).toBe('v2.0.0')
    expect(getLatestRelease).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('should fall back to the first stable release when there is no latest', async () => {
    getLatestRelease.mockRejectedValue({ status: 404 })
    listReleases.mockResolvedValue({
      data: [
        release('v3.0.0-rc1', { prerelease: true }),
        release('v2.9.0', { draft: true }),
        release('v2.8.0'),
        release('v2.7.0')
      ]
    })

    expect(await findLatestGitHubTag('owner/repo')).toBe('v2.8.0')
  })

  it('should rethrow other errors of the latest release lookup', async () => {
    getLatestRelease.mockRejectedValue({ status: 500 })

    await expect(findLatestGitHubTag('owner/repo')).rejects.toEqual({
      status: 500
    })
  })

  it('should pick the first stable release matching tag_regex', async () => {
    listReleases.mockResolvedValue({
      data: [
        release('cef-152.0.6'),
        release('v4.0.0-beta1', { prerelease: true }),
        release('v3.1.0', { draft: true }),
        release('v3.0.0'),
        release('v2.0.0')
      ]
    })

    expect(
      await findLatestGitHubTag('owner/repo', '^v\\d+\\.\\d+\\.\\d+$')
    ).toBe('v3.0.0')
    expect(getLatestRelease).not.toHaveBeenCalled()
  })

  it('should fall back to tags matching tag_regex when no release matches', async () => {
    listReleases.mockResolvedValue({ data: [release('other')] })
    listTags.mockResolvedValue({
      data: [{ name: 'junk' }, { name: 'v1.2.0' }, { name: 'v1.1.0' }]
    })

    expect(await findLatestGitHubTag('owner/repo', '^v\\d')).toBe('v1.2.0')
  })

  it('should fall back to the newest tag without tag_regex', async () => {
    getLatestRelease.mockRejectedValue({ status: 404 })
    listTags.mockResolvedValue({ data: [{ name: 'a' }, { name: 'b' }] })

    expect(await findLatestGitHubTag('owner/repo')).toBe('a')
  })

  it('should fail when there is no release or tag', async () => {
    getLatestRelease.mockRejectedValue({ status: 404 })

    await expect(findLatestGitHubTag('owner/repo')).rejects.toThrow(
      'No releases or tags found for repo owner/repo'
    )
    await expect(findLatestGitHubTag('owner/repo', '^v')).rejects.toThrow(
      'No releases or tags found'
    )
  })

  it('should propagate API errors', async () => {
    listReleases.mockRejectedValue(new Error('rate limited'))

    await expect(findLatestGitHubTag('owner/repo')).rejects.toThrow(
      'rate limited'
    )
  })
})
