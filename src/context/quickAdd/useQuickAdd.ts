import { useContext } from 'react'
import { QuickAddContext } from './quickAddContext'

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext)
  if (!ctx) throw new Error('useQuickAdd must be used inside <QuickAddProvider>')
  return ctx
}
