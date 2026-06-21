export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function riskEmoji(value: 'red' | 'yellow' | 'green') {
  switch (value) {
    case 'red':
      return '🔴'
    case 'yellow':
      return '🟡'
    case 'green':
      return '✅'
    default:
      return value
  }
}

export function riskLabel(value: 'red' | 'yellow' | 'green') {
  switch (value) {
    case 'red':
      return '高风险'
    case 'yellow':
      return '中风险'
    case 'green':
      return '低风险'
    default:
      return value
  }
}

export function divergenceLabel(value?: 'high' | 'medium' | null) {
  switch (value) {
    case 'high':
      return '高分歧'
    case 'medium':
      return '中分歧'
    default:
      return '-'
  }
}
