import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { CartProvider } from './context/cart/CartProvider'
import { InventoryProvider } from './context/inventory/InventoryProvider'
import { ProductModalProvider } from './context/productModal/ProductModalProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <InventoryProvider>
        <CartProvider>
          <ProductModalProvider>
            <App />
          </ProductModalProvider>
        </CartProvider>
      </InventoryProvider>
    </ThemeProvider>
  </StrictMode>,
)
