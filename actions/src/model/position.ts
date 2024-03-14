import * as Parser from 'web-tree-sitter'

export interface Position {
  start: Parser.Point
  end: Parser.Point
}
