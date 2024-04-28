import { PathLike } from 'fs'
import { readFile } from 'fs/promises'
import * as util from '../util'
import { Position } from './position'

interface Positions {
  checksums: Position
  pkgVer: Position
}

export class PkgBuild {
  private constructor(
    private readonly original: string,
    public pkgVer: string,
    public checksums: string[],
    readonly sources: string[],
    private readonly positions: Positions
  ) {}

  static async read(input: string): Promise<PkgBuild> {
    const tree = (await util.getParser()).parse(input)
    const sources: string[] = []
    const checksums: string[] = []
    let checksumsPosition: Position | undefined
    let pkgVerPosition: Position | undefined
    let pkgVer: string | undefined

    for (const node of tree.rootNode.descendantsOfType('variable_assignment')) {
      const lhs = node.firstNamedChild
      const rhs = node.lastNamedChild
      if (
        lhs?.text.startsWith('pkgver') &&
        rhs?.type &&
        ['word', 'string', 'raw_string'].includes(rhs?.type)
      ) {
        pkgVer = rhs.text

        pkgVerPosition = {
          start: rhs.startPosition,
          end: rhs.endPosition
        }
      }
      if (lhs?.text.startsWith('source') && rhs?.type === 'array') {
        sources.push(...(util.parseNode(rhs, true) as string[]))
      }
      if (lhs?.text.startsWith('sha256sum') && rhs?.type === 'array') {
        checksums.push(...(util.parseNode(rhs, true) as string[]))
        checksumsPosition = {
          start: rhs.startPosition,
          end: rhs.endPosition
        }
      }
    }

    if (!pkgVer || !pkgVerPosition) {
      throw new Error('Could not parse pkgVer')
    }
    if (!checksums.length || !checksumsPosition) {
      throw new Error('Could not parse checksums')
    }
    if (!sources.length) {
      throw new Error('Could not parse sources')
    }

    const positions = {
      checksums: checksumsPosition,
      pkgVer: pkgVerPosition
    }

    return new PkgBuild(input, pkgVer, checksums, sources, positions)
  }

  static async readFile(path: PathLike): Promise<PkgBuild> {
    return PkgBuild.read(await readFile(path, 'utf-8'))
  }

  stringify(): string {
    let result = util.replaceValue({
      original: this.original,
      position: this.positions.pkgVer,
      value: this.pkgVer
    })

    result = util.replaceValue({
      original: result,
      position: this.positions.checksums,
      value: `('${this.checksums.join("' '")}')`
    })

    return result
  }
}
