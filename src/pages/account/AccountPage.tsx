import type { ReactNode } from 'react'
import { useAccount } from '../../context/account/useAccount'
import './AccountPages.css'

interface AccountPageProps {
  kicker: string
  title: string
  backHref: string
  backLabel: string
  onOpenProfile: () => void
  children: ReactNode
}

/** Page frame for the signed-in pages (orders, order details, addresses). Asks guests to sign in. */
export function AccountPage({ kicker, title, backHref, backLabel, onOpenProfile, children }: AccountPageProps) {
  const account = useAccount()
  return (
    <main className="account-page">
      <div className="account-shell">
        <a className="page-back" href={backHref}>
          ← {backLabel}
        </a>
        <p className="page-kicker">{kicker}</p>
        <h1>{title}</h1>
        {!account.ready ? null : account.userId ? (
          <div className="acct account-content">{children}</div>
        ) : (
          <div className="account-signin">
            <p>Please sign in to see this page.</p>
            <button type="button" className="outline" onClick={onOpenProfile}>
              SIGN IN / CREATE ACCOUNT
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
