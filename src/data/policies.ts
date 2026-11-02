import type { Policy } from '../types'

/** `{email}` inside any text is rendered as a mailto link. */
export const POLICIES: Policy[] = [
  {
    id: 'policy-shipping',
    navLabel: 'Shipping & Delivery',
    number: '01 / DELIVERY',
    title: 'Shipping & Delivery Policy',
    blocks: [
      { text: 'We aim to process and deliver every DUSKEO order carefully and efficiently.' },
      { heading: 'Order processing', text: 'Orders are processed after payment confirmation. Orders placed on Sundays or public holidays may be processed on the next working day. We will share an order confirmation after a successful order.' },
      { heading: 'Delivery estimates', text: 'Estimated delivery timelines and applicable shipping charges will be shown at checkout or communicated before the order is placed. Delivery may take longer in remote areas or during public holidays, weather disruptions, or courier delays.' },
      { heading: 'Tracking', text: 'Where tracking is available, dispatch and tracking details will be shared using the contact information provided with the order.' },
      { heading: 'Delivery address', text: 'Please check your name, phone number, and delivery address carefully before placing an order. Contact us as soon as possible if you notice an error. Changes may not be possible after dispatch.' },
      { heading: 'Delayed or missing orders', text: 'If your order has not arrived within the communicated estimate, email {email} with your order number so we can check with the delivery partner.' },
    ],
  },
  {
    id: 'policy-returns',
    navLabel: 'Returns & Exchanges',
    number: '02 / RETURNS & EXCHANGES',
    title: 'Return & Exchange Policy',
    blocks: [
      { text: 'We want you to choose the right DUSKEO piece. Please review product details and the size guide before ordering.' },
      { heading: 'Change-of-mind returns', text: 'DUSKEO does not offer general returns or refunds simply because a customer changes their mind, chooses the wrong size, or no longer wants the product, except where required by applicable law.' },
      { heading: 'Size exchanges', text: 'Size exchanges may be requested within 7 days of delivery, subject to availability and approval. The item must be unused, unworn, unwashed, undamaged, and returned with its original tags and packaging. Contact us before sending anything back. Exchange shipping arrangements and any applicable charges will be explained before the exchange is confirmed.' },
      { heading: 'Damaged, defective, or incorrect items', text: 'If your order arrives damaged, defective, or different from what you ordered, contact us as soon as possible, preferably within 48 hours of delivery. Include your order number, a description, and clear photos or video of the issue. We will review the report and arrange an appropriate remedy, such as a replacement, exchange, or refund, as applicable.' },
      { heading: 'Important', text: 'Nothing in this policy limits any rights or remedies available to customers under applicable consumer protection laws. Do not send an item back before receiving instructions from our support team.' },
      { heading: 'Request an exchange or report an issue', text: 'Email {email} with your order number, product name, size, and reason for the request.' },
    ],
  },
  {
    id: 'policy-refunds',
    navLabel: 'Refunds',
    number: '03 / PAYMENTS',
    title: 'Refund Policy',
    blocks: [
      { text: 'Because DUSKEO does not offer general change-of-mind returns, refunds are considered where an order is cancelled before dispatch, cannot be fulfilled, is covered by an approved remedy for a damaged, defective, or incorrect item, or where a refund is otherwise required by law.' },
      { heading: 'Refund review', text: 'We may ask for the order number, photos, or other reasonable information to review a reported issue. We will communicate the outcome and next steps.' },
      { heading: 'Refund method and timing', text: 'Approved refunds will generally be sent to the original payment method where supported. Processing time depends on the payment provider and bank. Any estimated initiation timeline will be communicated when the refund is approved.' },
      { heading: 'Shipping charges', text: 'Shipping charges will be handled according to the reason for the refund and applicable law. We will explain any applicable charges before proceeding.' },
      { heading: 'Refund questions', text: 'For an update, email {email} with your order number.' },
    ],
  },
  {
    id: 'policy-cancellation',
    navLabel: 'Order Cancellation',
    number: '04 / ORDERS',
    title: 'Order Cancellation Policy',
    blocks: [
      { heading: 'Before dispatch', text: 'If you need to cancel an order, email us as soon as possible with your order number. Cancellation requests received before dispatch can generally be accommodated, subject to confirmation.' },
      { heading: 'After dispatch', text: 'Once an order has been handed to the delivery partner, it may not be possible to cancel it. Contact us for assistance. Any available options will be explained in line with our other policies and applicable law.' },
      { heading: 'Cancellation by DUSKEO', text: 'We may need to cancel an order if an item is unavailable, payment cannot be verified, order information is materially incomplete, or there is another legitimate operational or legal reason. If payment has been collected, an applicable refund will be initiated.' },
    ],
  },
  {
    id: 'policy-privacy',
    navLabel: 'Privacy',
    number: '05 / CUSTOMER INFORMATION',
    title: 'Privacy Policy',
    blocks: [
      { text: 'DUSKEO respects your privacy and handles personal information for legitimate business purposes.' },
      { heading: 'Information we may collect', text: 'This may include your name, email address, phone number, billing and delivery address, order and transaction details, customer support messages, and basic device or website-use information.' },
      { heading: 'How information is used', text: 'We use relevant information to process and deliver orders, confirm payments, share updates, respond to enquiries, manage exchanges and refunds, maintain website security, improve our services, and meet legal obligations.' },
      { heading: 'Service providers', text: "We may share information that is necessary with payment providers, courier partners, website hosting or technology providers, and authorities where required by law. We do not sell customers' personal information." },
      { heading: 'Payments and security', text: 'Payment details are handled by the payment provider used at checkout. We do not intend to store complete payment-card credentials on our own systems. We take reasonable steps to protect information, although no online system can guarantee absolute security.' },
      { heading: 'Retention and requests', text: 'We retain information for as long as reasonably necessary for orders, support, accounting, security, and legal requirements. Subject to applicable law, you may request access to, correction of, or deletion of personal information by emailing {email}.' },
      { heading: 'Cookies and updates', text: 'Our website may use cookies or similar technologies for essential functions and to understand website usage. We may update this policy when our practices or legal requirements change.' },
    ],
  },
  {
    id: 'policy-terms',
    navLabel: 'Terms & Conditions',
    number: '06 / WEBSITE USE',
    title: 'Terms & Conditions',
    blocks: [
      { heading: 'Using our website', text: 'By using the DUSKEO website, you agree to use it lawfully and not to interfere with its security or operation.' },
      { heading: 'Products and images', text: 'We make reasonable efforts to describe and photograph products accurately. Colors may look different on different screens, and minor variations in fabric, print, or finishing may occur. Please review product descriptions and size information before ordering.' },
      { heading: 'Prices and orders', text: 'Prices are displayed in Indian Rupees unless stated otherwise. Applicable delivery charges and taxes will be shown where relevant before checkout. Orders are subject to availability and payment confirmation. If we cannot fulfil an order, we will contact you and provide an appropriate resolution.' },
      { heading: 'Brand and content', text: 'DUSKEO names, logos, original designs, photographs, and website content may not be copied, reproduced, or commercially used without permission, except as allowed by law.' },
      { heading: 'Legal rights and changes', text: 'These terms do not exclude rights or remedies available under applicable law. We may update website terms from time to time; the latest version will be published here.' },
      { heading: 'Governing law', text: 'These terms are governed by the laws of India, subject to applicable consumer protection laws and the jurisdiction of competent courts.' },
    ],
  },
  {
    id: 'policy-grievance',
    navLabel: 'Contact & Grievance',
    number: '07 / SUPPORT',
    title: 'Contact & Grievance',
    showContactCard: true,
    blocks: [
      { text: 'For order questions, delivery concerns, exchange requests, refund updates, or complaints, contact DUSKEO using the details below.' },
      { heading: 'What to include', text: 'Please include your order number (if applicable), the email or phone number used at checkout, and a clear description of the issue. Add photos or documents where they help explain the concern.' },
      { heading: 'Grievance officer details', text: "The designated grievance contact's name and business address must be added here before the website goes live, as applicable under Indian law. Please do not publish placeholder or invented details." },
    ],
  },
]

/** Labelled lines shown after the grievance section's blocks. */
export const GRIEVANCE_DETAILS = [
  { label: 'Grievance Officer:', value: '[Business owner / designated officer name to be added]' },
  { label: 'Business Address:', value: '[Registered business address to be added]' },
]

export const POLICY_NOTE =
  "Last updated: [Add publication date]. These policies should be reviewed against DUSKEO's actual fulfilment, payment, and support arrangements before launch. Customer rights under applicable Indian law are not limited by these policies."
