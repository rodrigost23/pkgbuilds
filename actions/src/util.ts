import { SyntaxNode } from 'web-tree-sitter'

export function parseNode(node: SyntaxNode | null): string | number | any[] {
  if (node?.type === 'raw_string') {
    return node.text.replace(/^'(.*)'$/, '$1')
  } else if (node?.type === 'string') {
    return node.text.replace(/^"(.*)"$/, '$1')
  } else if (node?.type === 'word') {
    return parseFloat(node.text)
  } else if (node?.type === 'array') {
    return node.namedChildren.map(item => parseNode(item))
  } else
    throw new Error(
      `Could not parse node. Type: ${node?.type}. Value: ${node?.text}`
    )
}
