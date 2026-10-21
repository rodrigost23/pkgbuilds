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

    it('should carry tag_regex and use_tags through', () => {
      const input =
        '{"type": "github", "repo": "owner/repo", "tag_regex": "^v", "use_tags": true}'
      const result = PackageConfig.read(input)

      expect(result).toEqual({
        type: 'github',
        repo: 'owner/repo',
        tag_regex: '^v',
        use_tags: true
      })
    })

    it('should carry vars through and validate resolvers', () => {
      const vars = {
        a: { type: 'upstream_file', file: 'f', regex: '(x)' },
        b: { type: 'release_asset', tag: 't', asset_regex: 'r', strip: '.zip' }
      }
      const result = PackageConfig.read(
        JSON.stringify({ type: 'github', repo: 'owner/repo', vars })
      )
      expect(result.vars).toEqual(vars)

      for (const bad of [
        { a: { type: 'upstream_file', file: 'f' } },
        { a: { type: 'release_asset', tag: 't', asset_regex: 1 } },
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

    it('should return false for non-boolean use_tags', () => {
      expect(
        PackageConfig['isValidConfig']({
          type: 'github',
          repo: 'user/repo',
          use_tags: 'yes'
        })
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
