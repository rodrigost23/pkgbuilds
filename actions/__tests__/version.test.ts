import { compareVersions, versionParts } from '../src/version'

describe('version', () => {
  describe('compareVersions', () => {
    it('orders numeric segments numerically, not lexically', () => {
      expect(compareVersions('1.10.6', '1.10.7')).toBeLessThan(0)
      expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0)
    })

    it('handles a leading v prefix', () => {
      expect(compareVersions('v4.3.4', 'v3.0.2')).toBeGreaterThan(0)
      expect(compareVersions('v4.3.4', '4.3.4')).toBe(0)
    })

    it('compares different segment counts', () => {
      expect(compareVersions('1.2', '1.2.0')).toBeLessThan(0)
      expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0)
    })

    it('returns 0 for equal versions', () => {
      expect(compareVersions('6.2640.1', '6.2640.1')).toBe(0)
    })

    it('picks the newest across mixed tags', () => {
      const versions = ['v3.0.2', 'v4.3.4', 'v4.2.0']
      const latest = versions.reduce((a, b) =>
        compareVersions(b, a) > 0 ? b : a
      )
      expect(latest).toBe('v4.3.4')
    })
  })

  describe('versionParts', () => {
    it('splits and numerifies', () => {
      expect(versionParts('v1.10.7')).toEqual([1, 10, 7])
    })

    it('keeps non-numeric parts as strings', () => {
      expect(versionParts('1.7.1-beta1')).toEqual([1, 7, 1, 'beta1'])
    })
  })
})
