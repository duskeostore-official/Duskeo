import { useContext } from 'react'
import { CatalogContext } from './catalogContext'

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider')
  return context
}
