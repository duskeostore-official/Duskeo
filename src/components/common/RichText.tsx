import { Fragment, type ReactNode } from 'react'
import { CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../../constants/site'

const TOKENS: Record<string, ReactNode> = {
  '{email}': <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
  '{instagram}': (
    <a href={INSTAGRAM_URL} target="_blank" rel="noopener">
      {INSTAGRAM_HANDLE}
    </a>
  ),
}

/** Renders text, swapping `{email}` / `{instagram}` placeholders for links. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{email\}|\{instagram\})/).map((part, i) => (
        <Fragment key={i}>{TOKENS[part] ?? part}</Fragment>
      ))}
    </>
  )
}
