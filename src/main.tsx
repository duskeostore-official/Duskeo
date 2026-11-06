import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AccountProvider } from './context/account/AccountProvider'
import { CartProvider } from './context/cart/CartProvider'
import { InventoryProvider } from './context/inventory/InventoryProvider'
import { ProductModalProvider } from './context/productModal/ProductModalProvider'
import { QuickAddProvider } from './context/quickAdd/QuickAddProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { CatalogProvider } from './context/catalog/CatalogProvider'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <CatalogProvider>
        <InventoryProvider>
          <CartProvider>
            <AccountProvider>
              <ProductModalProvider>
                <QuickAddProvider>
                  <App />
                </QuickAddProvider>
              </ProductModalProvider>
            </AccountProvider>
          </CartProvider>
        </InventoryProvider>
      </CatalogProvider>
    </ThemeProvider>
  </StrictMode>,
)
