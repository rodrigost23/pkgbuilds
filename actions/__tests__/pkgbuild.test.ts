import { PkgBuild } from '../src/pkgbuild'

describe('pkgbuild', () => {
  it('should concatenate all sources', async () => {
    const pkgbuild = await PkgBuild.read(`
    sources=('a')
    sources_x86_64=('b' 3 'z')`)

    expect(pkgbuild.sources).toStrictEqual(['a', 'b', 3, 'z'])
  })
})
