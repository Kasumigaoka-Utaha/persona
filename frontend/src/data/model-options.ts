import type { AIModelProvider } from '../types/api'

export const AI_MODEL_OPTIONS: Array<{ value: AIModelProvider; label: string; description: string }> = [
  { value: 'deepseek', label: 'DeepSeek', description: 'DeepSeek' },
  { value: 'gemini', label: 'Gemini', description: 'Google Gemini' },
  { value: 'gpt', label: 'GPT', description: 'OpenAI GPT' },
]
