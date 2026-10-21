import { expandTemplate, resolveVars } from '../src/parser/vars'

type VarsModule = typeof import('../src/parser/vars')

// vars.ts keeps a reference to fetch taken at import time, so load a copy of
// the module after replacing it
function loadWithFetch(fetchMock: jest.Mock): VarsModule {
  let mod: VarsModule | undefined
  const originalFetch = global.fetch
  global.fetch = fetchMock as unknown as typeof fetch
  try {
    jest.isolateModules(() => {
      mod = require('../src/parser/vars')
    })
  } finally {
    global.fetch = originalFetch
  }
  return mod as VarsModule
}

const getReleaseByTag = jest.fn()

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: { repos: { getReleaseByTag } }
  }))
}))

const lockfile = `
[[package]]
name = "cef"
version = "152.3.0+152.0.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
`

describe('expandTemplate', () => {
  it('should replace known placeholders', () => {
    expect(expandTemplate('cef-{ver}-x', { ver: '1.2' })).toBe('cef-1.2-x')
  })

  it('should escape values for regular expressions', () => {
    expect(expandTemplate('^{ver}$', { ver: '1.2' }, true)).toBe('^1\\.2$')
  })

  it('should throw for unknown placeholders', () => {
    expect(() => expandTemplate('{nope}', {})).toThrow('Unknown variable')
  })
})

describe('resolveVars', () => {
  beforeEach(() => {
    getReleaseByTag.mockReset()
  })

  it('should resolve chained variables', async () => {
    const fetchMock = jest.fn()
    const { resolveVars: resolve } = loadWithFetch(fetchMock)

    fetchMock.mockResolvedValue({ ok: true, text: async () => lockfile })
    getReleaseByTag.mockResolvedValue({
      data: {
        assets: [
          {
            name: 'cef_binary_152.0.6+gabc+chromium-152.0.1_linux64_minimal.zip'
          },
          { name: 'cef_binary_152.0.6+gabc+chromium-152.0.1_linux64.zip' },
          {
            name: 'cef_binary_150.0.10+gdef+chromium-150.0.1_linux64_minimal.zip'
          }
        ]
      }
    })

    const resolved = await resolve('owner/repo', 'v4.3.4', '4.3.4', {
      _cefver: {
        type: 'upstream_file',
        file: 'Cargo.lock',
        regex: 'name = "cef"\\nversion = "[^+"]+\\+([0-9.]+)"'
      },
      _cefdir: {
        type: 'release_asset',
        tag: 'cef-{_cefver}-proprietary-codecs',
        asset_regex: '^cef_binary_{_cefver}\\+.*_linux64_minimal\\.zip$',
        strip: '.zip'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/owner/repo/v4.3.4/Cargo.lock'
    )
    expect(getReleaseByTag).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      tag: 'cef-152.0.6-proprietary-codecs'
    })
    expect(resolved).toEqual({
      _cefver: '152.0.6',
      _cefdir: 'cef_binary_152.0.6+gabc+chromium-152.0.1_linux64_minimal'
    })
  })

  it('should fail when the regex does not match', async () => {
    const fetchMock = jest.fn()
    const { resolveVars: resolve } = loadWithFetch(fetchMock)
    fetchMock.mockResolvedValue({ ok: true, text: async () => 'nothing' })

    await expect(
      resolve('o/r', 'v1', '1', {
        a: { type: 'upstream_file', file: 'f', regex: 'x(\\d)' }
      })
    ).rejects.toThrow('Failed to resolve a')
  })

  it('should fail unless exactly one asset matches', async () => {
    getReleaseByTag.mockResolvedValue({
      data: { assets: [{ name: 'a.zip' }, { name: 'b.zip' }] }
    })

    await expect(
      resolveVars('o/r', 'v1', '1', {
        a: { type: 'release_asset', tag: 't', asset_regex: '\\.zip$' }
      })
    ).rejects.toThrow('found 2')
  })
})
