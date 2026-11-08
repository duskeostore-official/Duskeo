import { Fragment, type ReactNode } from 'react'
import { ROUTES } from '../../constants/routes'
import { CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../../constants/site'

const TOKENS: Record<string, ReactNode> = {
  '{email}': <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
  '{orders}': <a href={ROUTES.orders}>My Orders</a>,
  '{instagram}': (
    <a href={INSTAGRAM_URL} target="_blank" rel="noopener">
      {INSTAGRAM_HANDLE}
    </a>
  ),
}

/** Renders text, replacing email, Instagram, and order-page placeholders with links. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{email\}|\{instagram\}|\{orders\})/).map((part, i) => (
        <Fragment key={i}>{TOKENS[part] ?? part}</Fragment>
      ))}
    </>
  )
}
