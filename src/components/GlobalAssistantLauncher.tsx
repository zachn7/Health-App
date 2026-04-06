import { lazy, Suspense, useEffect, useState } from 'react'
import { Brain, X } from 'lucide-react'
import { testIds } from '@/testIds'

const GlobalAssistantDrawer = lazy(() => import('./GlobalAssistantDrawer'))

export default function GlobalAssistantLauncher() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)

  useEffect(() => {
    if (isOpen) setHasOpened(true)
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        data-testid={testIds.assistant.fab}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700"
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Brain className="h-6 w-6" />}
      </button>

      {hasOpened && (
        <Suspense fallback={null}>
          <GlobalAssistantDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
