import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Compass, Flame, LineChart, Send, Sparkles, X } from 'lucide-react'
import { assistantService } from '@/ai/assistant-service'
import type { AssistantActionSuggestion, UserContextSnapshot } from '@/ai/types'
import { repositories } from '@/db'
import { formatWeight } from '@/lib/unit-conversions'
import type { MealPlan, Profile, WorkoutPlan } from '@/types'
import { testIds } from '@/testIds'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GlobalAssistantDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const STORAGE_KEY = 'global-ai-assistant-drawer'

const STARTER_PROMPTS = [
  {
    id: 'analyze-trends',
    icon: LineChart,
    label: 'Analyze my trends',
    prompt: 'Analyze my recent weight, workout, and nutrition trends and tell me the most important thing to adjust next.',
  },
  {
    id: 'next-workout',
    icon: Flame,
    label: 'What should I train next?',
    prompt: 'Based on my profile, recent consistency, and movement limitations, what should my next workout focus on?',
  },
  {
    id: 'meal-ideas',
    icon: Sparkles,
    label: 'Meal ideas that fit me',
    prompt: 'Give me a practical meal structure idea that fits my goals and dietary restrictions.',
  },
  {
    id: 'app-guidance',
    icon: Compass,
    label: 'Show me what to do in the app',
    prompt: 'What should I do next in this app today based on my progress and logging consistency?',
  },
]

function loadStoredState(): { messages: ChatMessage[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { messages: [] }
    const parsed = JSON.parse(raw)
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    }
  } catch {
    return { messages: [] }
  }
}

function formatAverage(value: number | null, unit: string): string {
  if (value === null) return '—'
  return `${Math.round(value)} ${unit}`
}

function getTrendTone(direction: UserContextSnapshot['progressSignals']['trendDirection'] | undefined) {
  switch (direction) {
    case 'down':
      return 'text-green-700'
    case 'up':
      return 'text-orange-700'
    default:
      return 'text-gray-700'
  }
}

export default function GlobalAssistantDrawer({ isOpen, onClose }: GlobalAssistantDrawerProps) {
  const initialState = useMemo(() => loadStoredState(), [])
  const [messages, setMessages] = useState<ChatMessage[]>(initialState.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [context, setContext] = useState<UserContextSnapshot | null>(null)
  const [generatedPlan, setGeneratedPlan] = useState<WorkoutPlan | null>(null)
  const [suggestedMealPlan, setSuggestedMealPlan] = useState<MealPlan | null>(null)
  const [actions, setActions] = useState<AssistantActionSuggestion[]>([])

  useEffect(() => {
    if (!isOpen) return

    repositories.profile.get().then((result) => setProfile(result || null)).catch((error) => {
      console.warn('Failed to load profile for global assistant:', error)
    })
  }, [isOpen])

  useEffect(() => {
    if (!profile || !isOpen) return

    assistantService.getContextSnapshot(profile)
      .then((snapshot) => setContext(snapshot))
      .catch((error) => {
        console.warn('Failed to build assistant context snapshot:', error)
      })
  }, [profile, isOpen])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }))
  }, [messages])

  const appendAssistantMessage = (content: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content }])
  }

  const sendPrompt = async (nextMessage: string) => {
    if (!nextMessage.trim() || loading) return

    let activeProfile = profile

    // Profile can be created/seeded after the app mounts. If state hasn't caught up yet,
    // do a quick read right before we give up.
    if (!activeProfile) {
      try {
        const fresh = await repositories.profile.get()
        activeProfile = fresh || null
        if (fresh) setProfile(fresh)
      } catch (error) {
        console.warn('Failed to refresh profile before sending assistant prompt:', error)
      }
    }

    if (!activeProfile) {
      appendAssistantMessage('You need to save your profile first so I can give you personalized coaching instead of generic gym-bro wallpaper text.')
      return
    }

    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: nextMessage }])

    try {
      const response = await assistantService.sendMessage(nextMessage, activeProfile)
      if (response.suggestedWorkoutPlan) setGeneratedPlan(response.suggestedWorkoutPlan)
      if (response.suggestedMealPlan) setSuggestedMealPlan(response.suggestedMealPlan)
      setActions(response.actions || [])
      appendAssistantMessage(response.message)
      setContext(await assistantService.getContextSnapshot(activeProfile))
    } catch (error) {
      console.error('Global assistant send failed:', error)
      appendAssistantMessage(`I hit an error while trying to help: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const userMessage = input.trim()
    if (!userMessage) return
    setInput('')
    await sendPrompt(userMessage)
  }

  const handleAction = async (action: AssistantActionSuggestion) => {
    try {
      if ((action.type === 'open_page' || action.type === 'log_weight' || action.type === 'log_workout' || action.type === 'log_meal') && typeof action.payload?.path === 'string') {
        window.location.hash = `#${action.payload.path}`
        onClose()
        return
      }

      if (action.type === 'accept_workout_plan' && generatedPlan) {
        const savedPlan = await repositories.workout.createWorkoutPlan(generatedPlan)
        setGeneratedPlan(savedPlan)
        appendAssistantMessage('Workout plan saved. Look at that, we did something useful.')
        return
      }

      if (action.type === 'accept_meal_plan' && suggestedMealPlan) {
        await repositories.nutrition.createMealPlan({
          name: suggestedMealPlan.name,
          startDate: suggestedMealPlan.startDate,
          endDate: suggestedMealPlan.endDate,
          days: suggestedMealPlan.days,
          generationType: suggestedMealPlan.generationType,
          constraintsSnapshot: suggestedMealPlan.constraintsSnapshot,
          notes: suggestedMealPlan.notes,
        })
        appendAssistantMessage('Meal plan saved. Your future self can now be fed with slightly less chaos.')
        return
      }
    } catch (error) {
      console.error('Global assistant action failed:', error)
      appendAssistantMessage(`That action failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  const trendSummary = context?.progressSignals
  const preferenceSummary = context?.preferenceSignals
  const preferredUnits = profile?.preferredUnits || 'metric'

  return (
    <div className={`fixed inset-0 z-[55] bg-black/30 transition ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose}>
      <aside
        data-testid={testIds.assistant.drawer}
        className={`absolute bottom-0 right-0 h-full w-full bg-white shadow-2xl transition-transform duration-200 sm:bottom-24 sm:right-6 sm:h-[min(42rem,calc(100vh-8rem))] sm:max-w-md sm:rounded-2xl ${isOpen ? 'translate-x-0 sm:translate-y-0' : 'translate-x-full sm:translate-x-0 sm:translate-y-6'}`}
        onClick={(event) => event.stopPropagation()}
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-gray-900">
                  <Sparkles className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold">AI Assistant</h2>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Fitness-only help across the app: workouts, meals, recovery, logging, and progress analysis. No random homework side quests.
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close assistant">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div data-testid={testIds.assistant.trendSummary} className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-900">
                <BarChart3 className="h-4 w-4" />
                Snapshot
              </div>

              {!profile && (
                <div className="text-sm text-gray-700">
                  Save your profile first so the assistant can stop guessing and start coaching.
                </div>
              )}

              {profile && !context && (
                <div className="text-sm text-gray-600">Loading your stats and preferences...</div>
              )}

              {profile && context && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Weight trend</div>
                    <div className={`mt-1 font-semibold ${getTrendTone(trendSummary?.trendDirection)}`}>
                      {trendSummary?.trendDirection ? `${trendSummary.trendDirection} • ${formatWeight(trendSummary.trendWeightKg ?? 0, preferredUnits)}` : 'Not enough data yet'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Workouts / week</div>
                    <div className="mt-1 font-semibold text-gray-900">{trendSummary?.workoutsPerWeek.toFixed(1) || '0.0'}</div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Avg calories</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatAverage(trendSummary?.averageCaloriesLast14 ?? null, 'kcal')}</div>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Avg protein</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatAverage(trendSummary?.averageProteinLast14 ?? null, 'g')}</div>
                  </div>
                </div>
              )}

              {context && (
                <div className="mt-3 text-xs text-gray-600">
                  Constraints: {preferenceSummary?.movementLimitations.join(', ') || 'none saved'} • Diet: {preferenceSummary?.dietaryRestrictions.join(', ') || 'none saved'}
                </div>
              )}
            </div>

            {messages.length === 0 && (
              <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
                <div className="text-sm text-gray-700">
                  Pick a guided prompt or ask about workouts, meals, recovery, trends, form, or what to do next in the app.
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_PROMPTS.map((starter) => {
                    const Icon = starter.icon
                    return (
                      <button
                        key={starter.id}
                        type="button"
                        data-testid={testIds.assistant.starter(starter.id)}
                        onClick={() => void sendPrompt(starter.prompt)}
                        className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{starter.label}</div>
                          <div className="text-xs text-gray-600">{starter.prompt}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'ml-10 bg-primary-600 text-white' : 'mr-10 bg-gray-100 text-gray-800'}`}
              >
                {message.content}
              </div>
            ))}

            {actions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested actions</div>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      data-testid={testIds.assistant.action(action.id)}
                      onClick={() => void handleAction(action)}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
                      title={action.description}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4">
            <div className="mb-2 text-xs text-gray-500">
              Domain lock is on: fitness, nutrition, recovery, trends, and app guidance only.
            </div>
            <div className="flex items-end gap-2">
              <textarea
                data-testid={testIds.assistant.input}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
                rows={3}
                placeholder={profile ? 'Ask a fitness or nutrition question...' : 'Save your profile first for personalized help...'}
                className="input min-h-[88px] flex-1 resize-none"
              />
              <button
                type="button"
                data-testid={testIds.assistant.send}
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                className="btn btn-primary h-11"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {loading && <div className="mt-2 text-xs text-gray-500">Thinking...</div>}
          </div>
        </div>
      </aside>
    </div>
  )
}
