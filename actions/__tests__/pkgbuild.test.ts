import { PkgBuild } from '../src/model/pkgbuild'

describe('pkgbuild', () => {
  it('should concatenate all sources', async () => {
    const pkgbuild = await PkgBuild.read(`
    pkgver=1.0
    sha256sums=('abc123')
    source=('a')
    sha256sums_x86_64=('abc123' 'def456' 'ghi789')
    source_x86_64=('b' 3 'z')`)

    expect(pkgbuild.sources).toStrictEqual(['a', 'b', 3, 'z'])
  })

  it('should parse sources from PKGBUILD', async () => {
    const input = `
      pkgname=example
      pkgver=1.0
      pkgrel=1
      sha256sums=('abc123')
      source=("http://example.com/\${pkgname}-\${pkgver}.tar.gz")
    `

    const pkgbuild = await PkgBuild.read(input)

    expect(pkgbuild.sources).toEqual(['http://example.com/example-1.0.tar.gz'])
  })

  it('should handle multiple sources', async () => {
    const input = `
      pkgname=example
      pkgver=1.0
      pkgrel=1
      sha256sums=('abc123' '789456')
      source=('http://url1' 'http://url2')
    `

    const pkgbuild = await PkgBuild.read(input)

    expect(pkgbuild.sources).toEqual(['http://url1', 'http://url2'])
  })

  it('should throw error if a variable is missing', async () => {
    const noPkgVer = `
      pkgname=example
      source=("http://url")
    `
    await expect(async () => {
      await PkgBuild.read(noPkgVer)
    }).rejects.toThrow()

    const noSource = `
      pkgver=1.0
    `
    await expect(async () => {
      await PkgBuild.read(noSource)
    }).rejects.toThrow()
  })

  describe('stringify', () => {
    it('should replace a changed pkgVer', async () => {
      const pkgBuild = await PkgBuild.read(`
        pkgname=example  
        pkgver=1.0
        sha256sums=('abc123')
        source=("http://url")
      `)

      pkgBuild.pkgVer = '2.0'

      expect(pkgBuild.stringify()).toBe(`
        pkgname=example  
        pkgver=2.0
        sha256sums=('abc123')
        source=("http://url")
      `)
    })

    it('should replace a changed sha256sums', async () => {
      const pkgBuild = await PkgBuild.read(`
        pkgname=example  
        pkgver=1.0
        sha256sums=('abc123')
        source=("http://url")
      `)

      pkgBuild.checksums = ['def456']

      expect(pkgBuild.stringify()).toBe(`
        pkgname=example  
        pkgver=1.0
        sha256sums=('def456')
        source=("http://url")
      `)
    })
  })
})
