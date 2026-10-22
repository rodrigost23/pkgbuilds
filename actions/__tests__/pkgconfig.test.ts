import { PackageConfig } from '../src/model/pkgconfig'

describe('PkgConfig', () => {
  describe('read', () => {
    it('should return GitHubPkg for valid input', () => {
      const input = '{"type": "github", "repo": "owner/repo"}'
      const result = PackageConfig.read(input)

      expect(result).toEqual({
        type: 'github',
        repo: 'owner/repo'
      })
    })

    it('should carry tag_regex through', () => {
      const input =
        '{"type": "github", "repo": "owner/repo", "tag_regex": "^v"}'
      const result = PackageConfig.read(input)

      expect(result).toEqual({
        type: 'github',
        repo: 'owner/repo',
        tag_regex: '^v'
      })
    })

    it('should return GitPkg for valid input', () => {
      const input = `{"type": "git", "url": "https://example.com/o/r.git",
        "tag_regex": "^v", "version_regex": "^v(\\\\d+)-x$"}`
      const result = PackageConfig.read(input)

      expect(result).toEqual({
        type: 'git',
        url: 'https://example.com/o/r.git',
        tag_regex: '^v',
        version_regex: '^v(\\d+)-x$'
      })
    })

    it('should throw error for git without url', () => {
      expect(() => PackageConfig.read('{"type": "git"}')).toThrow()
    })

    it('should throw error for invalid regexes', () => {
      expect(() =>
        PackageConfig.read('{"type": "git", "url": "u", "tag_regex": "("}')
      ).toThrow()
      expect(() =>
        PackageConfig.read('{"type": "git", "url": "u", "version_regex": "["}')
      ).toThrow()
      expect(() =>
        PackageConfig.read(
          '{"type": "github", "repo": "o/r", "tag_regex": "("}'
        )
      ).toThrow()
    })

    it('should drop the removed use_tags option', () => {
      const result = PackageConfig.read(
        '{"type": "github", "repo": "o/r", "use_tags": true}'
      )

      expect(result).not.toHaveProperty('use_tags')
    })

    it('should carry vars through and validate resolvers', () => {
      const vars = {
        a: { type: 'upstream_file', file: 'f', regex: '(x)' },
        b: { type: 'upstream_file', file: 'f', regex: '(x)', decode: 'url' },
        c: { type: 'template', value: '{tag}' }
      }
      const result = PackageConfig.read(
        JSON.stringify({ type: 'github', repo: 'owner/repo', vars })
      )
      expect(result.vars).toEqual(vars)

      for (const bad of [
        { a: { type: 'upstream_file', file: 'f' } },
        { a: { type: 'upstream_file', file: 'f', regex: '(' } },
        { a: { type: 'upstream_file', file: 'f', regex: 'x', decode: 'b64' } },
        { a: { type: 'template' } },
        { a: { type: 'release_asset', tag: 't', asset_regex: 'r' } },
        { a: { type: 'unknown' } },
        'nope'
      ]) {
        expect(() =>
          PackageConfig.read(
            JSON.stringify({ type: 'github', repo: 'owner/repo', vars: bad })
          )
        ).toThrow()
      }
    })

    it('should throw error for invalid type', () => {
      const input = '{"type": "invalid", "repo": "owner/repo"}'

      expect(() => PackageConfig.read(input)).toThrow()
    })

    it('should throw error for missing repo', () => {
      const input = '{"type": "github"}'

      expect(() => PackageConfig.read(input)).toThrow()
    })

    it('should throw error for non-object input', () => {
      const input = 'invalid'

      expect(() => PackageConfig.read(input)).toThrow()
    })
  })

  describe('isValidConfig', () => {
    it('should return false for non-object', () => {
      expect(PackageConfig['isValidConfig']('')).toBe(false)
    })

    it('should return false for missing type', () => {
      expect(PackageConfig['isValidConfig']({ repo: 'user/repo' })).toBe(false)
    })

    it('should return false for invalid type', () => {
      expect(
        PackageConfig['isValidConfig']({ type: 'gitlab', repo: 'user/repo' })
      ).toBe(false)
    })

    it('should return false for missing repo', () => {
      expect(PackageConfig['isValidConfig']({ type: 'github' })).toBe(false)
    })

    it('should return false for non-string repo', () => {
      expect(
        PackageConfig['isValidConfig']({ type: 'github', repo: 123 })
      ).toBe(false)
    })

    it('should return true for valid config', () => {
      expect(
        PackageConfig['isValidConfig']({ type: 'github', repo: 'user/repo' })
      ).toBe(true)
    })

    it('should return true for valid config with use_tags', () => {
      expect(
        PackageConfig['isValidConfig']({
          type: 'github',
          repo: 'user/repo',
          use_tags: true
        })
      ).toBe(true)
    })
  })
})
