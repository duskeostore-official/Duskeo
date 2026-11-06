import { AddressBook } from '../../components/account/AddressBook'
import '../../components/account/AccountSections.css'
import { ROUTES } from '../../constants/routes'
import { AccountPage } from './AccountPage'

/** Every saved address, with the same add / edit / make default / delete options as the panel. */
export function AddressesPage({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <AccountPage
      kicker="DUSKEO / YOUR ACCOUNT"
      title="SAVED ADDRESSES"
      backHref={ROUTES.home}
      backLabel="BACK TO DUSKEO"
      onOpenProfile={onOpenProfile}
    >
      <AddressBook />
    </AccountPage>
  )
}
