import type { AssistantResponse } from './types'

const FITNESS_DOMAIN_KEYWORDS = [
  'workout', 'exercise', 'lift', 'lifting', 'gym', 'training', 'program', 'plan', 'coach',
  'meal', 'meals', 'nutrition', 'protein', 'calories', 'macro', 'macros', 'diet', 'food',
  'weight', 'weigh', 'body fat', 'progress', 'mobility', 'stretch', 'recovery', 'soreness',
  'cardio', 'run', 'running', 'walk', 'steps', 'strength', 'muscle', 'fat loss', 'bulking',
  'cut', 'maintenance', 'injury', 'pain', 'form', 'sleep', 'hydration', 'water', 'supplement',
  'log', 'logging', 'track', 'tracker', 'meal prep', 'warm up', 'cool down',
]

const OUT_OF_DOMAIN_PATTERNS = [
  /\b(algebra|calculus|geometry|math|equation|integral|derivative)\b/i,
  /\b(code|typescript|javascript|react|css|bug|debug|compile|build error)\b/i,
  /\b(write an essay|email|cover letter|resume|poem|story|translate)\b/i,
  /\b(stock|crypto|invest|tax|legal advice|contract)\b/i,
]

export function isFitnessDomainMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return true

  if (OUT_OF_DOMAIN_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false
  }

  return FITNESS_DOMAIN_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function buildOutOfDomainResponse(): AssistantResponse {
  return {
    provider: 'deterministic',
    intent: 'out_of_domain',
    message: 'Nice try, but this assistant is domain-locked to fitness, nutrition, recovery, and in-app progress help. Ask me for a workout tweak, meal idea, trend breakdown, logging help, or mobility guidance instead of making me cosplay as your tax attorney or algebra tutor.',
    actions: [
      {
        id: crypto.randomUUID(),
        type: 'open_page',
        label: 'Open Progress',
        description: 'Review your weight trend and workout consistency.',
        payload: { path: '/progress' },
      },
      {
        id: crypto.randomUUID(),
        type: 'open_page',
        label: 'Open Coach',
        description: 'Generate a workout or meal plan with your saved profile.',
        payload: { path: '/coach' },
      },
    ],
  }
}
