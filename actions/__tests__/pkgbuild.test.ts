import { PkgBuild } from '../src/model/pkgbuild'

describe('pkgbuild', () => {
  it('should concatenate all sources', async () => {
    const pkgbuild = await PkgBuild.read(`
    source=('a')
    source_x86_64=('b' 3 'z')`)

    expect(pkgbuild.sources).toStrictEqual(['a', 'b', 3, 'z'])
  })

  it('should parse sources from PKGBUILD', async () => {
    const input = `
      pkgname=example
      pkgver=1.0
      pkgrel=1
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
      source=('http://url1' 'http://url2')
    `

    const pkgbuild = await PkgBuild.read(input)

    expect(pkgbuild.sources).toEqual(['http://url1', 'http://url2'])
  })

  it('should ignore non-source variables', async () => {
    const input = `
      pkgname=example
      pkgver=1.0
      pkgrel=1
      options=('!docs')
    `

    const pkgbuild = await PkgBuild.read(input)

    expect(pkgbuild.sources).toEqual([])
  })
})
