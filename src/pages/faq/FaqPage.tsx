import { RichText } from '../../components/common/RichText'
import { ROUTES } from '../../constants/routes'
import { FAQ_ITEMS } from '../../data/faq'
import './FaqPage.css'

export function FaqPage() {
  return (
    <main className="faq-page">
      <div className="faq-shell">
        <a className="page-back" href={ROUTES.home}>
          ← BACK TO DUSKEO
        </a>
        <p className="page-kicker">DUSKEO / CUSTOMER CARE</p>
        <h1>FREQUENTLY ASKED QUESTIONS</h1>
        <p className="page-intro">A few helpful answers before you make your selection.</p>
        <section className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>
                <RichText text={item.answer} />
              </p>
              {item.link && <a href={item.link.href}>{item.link.label}</a>}
            </details>
          ))}
        </section>
      </div>
    </main>
  )
}
