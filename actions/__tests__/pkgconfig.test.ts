import { PkgConfig } from '../src/model/pkgconfig'

describe('PkgConfig', () => {
  describe('read', () => {
    it('should return GitHubPkg for valid input', () => {
      const input = '{"type": "github", "repo": "owner/repo"}'
      const result = PkgConfig.read(input)

      expect(result).toEqual({
        type: 'github',
        repo: 'owner/repo'
      })
    })

    it('should throw error for invalid type', () => {
      const input = '{"type": "invalid", "repo": "owner/repo"}'

      expect(() => PkgConfig.read(input)).toThrow()
    })

    it('should throw error for missing repo', () => {
      const input = '{"type": "github"}'

      expect(() => PkgConfig.read(input)).toThrow()
    })

    it('should throw error for non-object input', () => {
      const input = 'invalid'

      expect(() => PkgConfig.read(input)).toThrow()
    })
  })
})
