import * as util from '../util'
import { Position } from './position'

interface Positions {
  pkgVer: Position
}

export class PkgBuild {
  private constructor(
    private readonly original: string,
    public pkgVer: string,
    readonly sources: string[],
    private readonly positions: Positions
  ) {}

  static async read(input: string): Promise<PkgBuild> {
    const tree = (await util.getParser()).parse(input)
    const sources: string[] = []
    let positions: Positions | undefined
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

        positions = {
          pkgVer: {
            start: lhs.startPosition,
            end: rhs.endPosition
          }
        }
      }
      if (lhs?.text.startsWith('source') && rhs?.type === 'array') {
        sources.push(...(util.parseNode(rhs, true) as string[]))
      }
    }

    if (!pkgVer) {
      throw new Error('Could not parse pkgVer')
    }
    if (!sources.length) {
      throw new Error('Could not parse sources')
    }
    if (!positions) {
      throw new Error('Could not parse positions')
    }

    return new PkgBuild(input, pkgVer, sources, positions)
  }

  stringify(): string {
    return util.replaceValue({
      original: this.original,
      position: this.positions.pkgVer,
      value: this.pkgVer
    })
  }
}
