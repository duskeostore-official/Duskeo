import { OrderList } from '../../components/account/OrderList'
import '../../components/account/AccountSections.css'
import { ROUTES } from '../../constants/routes'
import { AccountPage } from './AccountPage'

/** Every order, newest first. Each opens its detail page. */
export function OrdersPage({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <AccountPage
      kicker="DUSKEO / YOUR ACCOUNT"
      title="MY ORDERS"
      backHref={ROUTES.home}
      backLabel="BACK TO DUSKEO"
      onOpenProfile={onOpenProfile}
    >
      <OrderList />
    </AccountPage>
  )
}
