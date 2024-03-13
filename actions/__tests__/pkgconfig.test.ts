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

  describe('isValidConfig', () => {
    it('should return false for non-object', () => {
      expect(PkgConfig['isValidConfig']('')).toBe(false)
    })

    it('should return false for missing type', () => {
      expect(PkgConfig['isValidConfig']({ repo: 'user/repo' })).toBe(false)
    })

    it('should return false for invalid type', () => {
      expect(
        PkgConfig['isValidConfig']({ type: 'gitlab', repo: 'user/repo' })
      ).toBe(false)
    })

    it('should return false for missing repo', () => {
      expect(PkgConfig['isValidConfig']({ type: 'github' })).toBe(false)
    })

    it('should return false for non-string repo', () => {
      expect(PkgConfig['isValidConfig']({ type: 'github', repo: 123 })).toBe(
        false
      )
    })

    it('should return true for valid config', () => {
      expect(
        PkgConfig['isValidConfig']({ type: 'github', repo: 'user/repo' })
      ).toBe(true)
    })
  })
})
