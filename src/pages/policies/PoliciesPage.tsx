import { RichText } from '../../components/common/RichText'
import { ROUTES } from '../../constants/routes'
import { CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../../constants/site'
import { GRIEVANCE_DETAILS, POLICIES, POLICY_NOTE } from '../../data/policies'
import './PoliciesPage.css'

export function PoliciesPage({ policyId }: { policyId: string }) {
  const policy = POLICIES.find((p) => p.id === policyId) ?? POLICIES[0]

  return (
    <main className="policy-page">
      <div className="policy-shell">
        <a className="page-back" href={ROUTES.home}>
          ← BACK TO DUSKEO
        </a>
        <p className="page-kicker">DUSKEO / CUSTOMER CARE</p>
        <h1>POLICIES</h1>
        <p className="page-intro">Clear information. Thoughtful service. The details behind every DUSKEO order.</p>

        <nav className="policy-nav" aria-label="Policies">
          {POLICIES.map((p) => (
            <a key={p.id} href={`#${p.id}`} className={p.id === policy.id ? 'active' : undefined}>
              {p.navLabel}
            </a>
          ))}
        </nav>

        <section className="policy-section">
          <p className="page-kicker">{policy.number}</p>
          <h2>{policy.title}</h2>
          {policy.blocks.map((block, i) => (
            <div key={i}>
              {block.heading && <h3>{block.heading}</h3>}
              <p>
                <RichText text={block.text} />
              </p>
              {policy.showContactCard && i === 0 && (
                <div className="policy-contact">
                  <strong>Email</strong>
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  <strong>Instagram</strong>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener">
                    {INSTAGRAM_HANDLE}
                  </a>
                </div>
              )}
            </div>
          ))}
          {policy.showContactCard &&
            GRIEVANCE_DETAILS.map((d) => (
              <p key={d.label}>
                <strong>{d.label}</strong> {d.value}
              </p>
            ))}
        </section>

        <p className="policy-note">{POLICY_NOTE}</p>
      </div>
    </main>
  )
}
