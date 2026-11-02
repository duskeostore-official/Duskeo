export interface FaqItem {
  question: string
  /** `{email}` and `{instagram}` become links. */
  answer: string
  link?: { href: string; label: string }
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is the fit of DUSKEO T-shirts?',
    answer:
      'Our current collection is designed around an oversized-fit direction. Please use the product size chart and compare the measurements with a T-shirt you already own. Final fit must be confirmed against the production sample.',
  },
  {
    question: 'What fabric do you use?',
    answer:
      'The planned product specification is cotton at 180 GSM. This should be confirmed with the manufacturer for the final production batch.',
  },
  {
    question: 'Which sizes are available?',
    answer:
      'The product pages show S, M, L, XL and XXL. Actual availability will depend on confirmed stock for each product and size.',
  },
  {
    question: 'How should I care for my T-shirt?',
    answer:
      'Wash inside out with similar colors using cold water and a gentle cycle. Do not bleach. Avoid ironing directly over printed artwork. Dry in shade and follow the care label supplied with the garment.',
  },
  {
    question: 'Can I return or exchange an item?',
    answer:
      'Please read our Returns & Exchanges Policy before ordering. General change-of-mind returns are not offered, while eligible size exchanges and remedies for defective, damaged or incorrect items are handled under the policy and applicable law.',
    link: { href: '#policy-returns', label: 'READ RETURNS & EXCHANGES POLICY →' },
  },
  {
    question: 'How can I contact DUSKEO?',
    answer: 'Email {email} or message us on Instagram {instagram}.',
  },
  {
    question: 'Can I track my order?',
    answer:
      "Order tracking will be available once the store's order and shipping systems are connected. For now, contact DUSKEO with your order details for assistance.",
  },
]
