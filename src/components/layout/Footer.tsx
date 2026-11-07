import { CONTACT_EMAIL, INSTAGRAM_URL } from '../../constants/site'
import './Footer.css'

const POLICY_LINKS = [
  { href: '#faq', label: 'FAQ' },
  { href: '#policy-shipping', label: 'POLICIES' },
  { href: '#policy-returns', label: 'RETURNS & EXCHANGES' },
  { href: '#policy-privacy', label: 'PRIVACY' },
  { href: '#policy-terms', label: 'TERMS' },
]

export function Footer() {
  return (
    <footer className="footer" id="footer">
      <span>© DUSKEO — BEYOND ORDINARY</span>
      <span>WEAR PROGRESS. REPEAT.</span>
      <span className="footer-policy-links">
        {POLICY_LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </span>
      <span className="footer-contact">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener">
          INSTAGRAM
        </a>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${CONTACT_EMAIL}`}>CONTACT</a>
      </span>
    </footer>
  )
}
