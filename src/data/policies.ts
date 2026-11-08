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
      { heading: 'Shipping charges', text: 'Orders below ₹1,498 have a ₹99 shipping charge. Orders of ₹1,498 or more qualify for free shipping. The applicable charge is shown at checkout before you place your order.' },
      { heading: 'Order processing', text: 'After an order is successfully confirmed, it is generally dispatched within approximately 2 business days. Processing may take longer during sales, holidays, or exceptional circumstances. We will send an order confirmation after a successful order.' },
      { heading: 'Delivery estimates', text: 'Delivery across India is estimated at approximately 2–10 days after dispatch. The actual timeline depends on your location and courier partner. Weather, courier-service disruptions, holidays, and other circumstances may cause delays; we will share updates when available.' },
      { heading: 'Tracking', text: 'After dispatch, available tracking details or a tracking link will appear in {orders} or be shared using the contact information provided with your order. If tracking is not available, contact {email} with your order number.' },
      { heading: 'Delivery address', text: 'Please check your name, phone number, and delivery address carefully before placing an order. Contact us as soon as possible if you notice an error. Address changes may not be possible after dispatch.' },
      { heading: 'Delayed or missing orders', text: 'If your order has not arrived within the communicated estimate, email {email} with your order number so we can check with the delivery partner.' },
    ],
  },
  {
    id: 'policy-returns',
    navLabel: 'Returns & Exchanges',
    number: '02 / RETURNS & EXCHANGES',
    title: 'Return & Exchange Policy',
    blocks: [
      { text: 'You may request a return or exchange within 3 days of delivery. Requests are reviewed under this policy and applicable consumer law.' },
      { heading: 'Eligibility and item condition', text: 'Items must be unused, unwashed, undamaged, and in their original condition, with original tags and packaging retained. Items that have been used, washed, damaged by the customer, or returned without their original tags may not qualify, subject to rights and remedies under applicable law. Include your order ID and the relevant product details in your request.' },
      { heading: 'Damaged, defective, or incorrect items', text: 'Report a damaged, defective, or incorrect item within 24 hours of delivery. Include your order ID, product details, a description of the issue, and clear photographs or video. We will review the request before confirming approval or next steps.' },
      { heading: 'Reverse pickup', text: 'The first approved reverse pickup may be free. Subsequent approved reverse pickups may incur a ₹100 charge. Any applicable charge will be disclosed before pickup is confirmed and remains subject to applicable law.' },
      { heading: 'Sale and discounted products', text: 'Additional conditions may apply to sale or discounted products only where disclosed before purchase. They do not limit any mandatory rights or remedies under applicable consumer law.' },
      { heading: 'Important', text: 'Nothing in this policy limits any rights or remedies available to customers under applicable consumer protection laws. Do not send an item back before receiving instructions from our support team.' },
      { heading: 'Request a return or exchange', text: 'Email {email} within the applicable request window with your order ID, product name, size, and reason. Wait for our review and instructions before sending an item back.' },
    ],
  },
  {
    id: 'policy-refunds',
    navLabel: 'Refunds',
    number: '03 / PAYMENTS',
    title: 'Refund Policy',
    blocks: [
      { text: 'Refund requests are reviewed and, if approved, processed in accordance with the Returns & Exchanges Policy, Cancellation Policy, and applicable law.' },
      { heading: 'Refund review and confirmation', text: 'We may ask for your order ID, product details, photographs, or other reasonable information to review a request. We will notify you when the request is approved and explain the next steps.' },
      { heading: 'Refund method and timing', text: 'Where applicable and technically possible, an approved refund will be issued to the original payment method. Processing time depends on the payment provider or bank. If store credit is offered, it is an optional alternative and will not replace a monetary refund required by applicable law.' },
      { heading: 'Shipping charges', text: 'Shipping charges for customer-initiated returns may be non-refundable where permitted by applicable law. Refunds for defective, damaged, incorrect, or undelivered products will be handled in accordance with applicable consumer law. We will explain any applicable treatment when the request is reviewed.' },
      { heading: 'Refund questions', text: 'For an update, email {email} with your order number.' },
    ],
  },
  {
    id: 'policy-cancellation',
    navLabel: 'Order Cancellation',
    number: '04 / ORDERS',
    title: 'Order Cancellation Policy',
    blocks: [
      { heading: 'Before dispatch', text: 'You may request cancellation before your order is dispatched. Email {email} as soon as possible with your order ID; cancellation is subject to confirmation.' },
      { heading: 'After dispatch', text: 'Once an order has been dispatched, cancellation may not be possible. Contact us for assistance; any available options will be explained in line with our other policies and applicable law.' },
      { heading: 'Cancellation by DUSKEO', text: 'DUSKEO may cancel an order for valid reasons, including stock unavailability, unsuccessful payment, suspected fraudulent activity, or a pricing error. We will notify you if we cancel your order. If payment has been collected, any applicable refund will be processed under the Refund Policy and applicable law.' },
    ],
  },
  {
    id: 'policy-privacy',
    navLabel: 'Privacy',
    number: '05 / CUSTOMER INFORMATION',
    title: 'Privacy Policy',
    blocks: [
      { text: 'DUSKEO collects and uses customer information to operate the store, fulfil orders, provide support, and meet legal obligations.' },
      { heading: 'Information we collect', text: 'Depending on how you use the website, this may include your name, email address, phone number, shipping and billing address, order and transaction information, messages sent to customer support, and website or device usage information where applicable.' },
      { heading: 'How we use information', text: 'We use information to process and deliver orders, communicate order and shipping updates, provide customer support, improve website performance and the shopping experience, help prevent fraud and unauthorized transactions, and comply with applicable legal requirements.' },
      { heading: 'Service providers', text: 'We share information only as reasonably needed with providers supporting the website and its services, including Vercel for website hosting, Supabase for backend services, the payment provider selected at checkout, and delivery partners. We may also disclose information where required by law.' },
      { heading: 'Payments and data security', text: 'Payments are processed through third-party payment providers. DUSKEO does not claim to store card details. We use reasonable measures to protect customer information, but no online service can guarantee absolute security.' },
      { heading: 'Retention and privacy requests', text: 'We retain information for as long as reasonably necessary for order fulfilment, customer support, accounting, security, and legal requirements. For privacy questions or requests concerning your information, email {email}.' },
      { heading: 'Cookies and updates', text: 'The website may use cookies or similar technologies where needed for site functions or to understand website usage. We may update this policy when our practices or legal requirements change.' },
    ],
  },
  {
    id: 'policy-terms',
    navLabel: 'Terms & Conditions',
    number: '06 / WEBSITE USE',
    title: 'Terms & Conditions',
    blocks: [
      { heading: 'Website usage', text: 'Use the DUSKEO website lawfully. Unauthorized attempts to access, interfere with, or disrupt the website, its accounts, or its systems are prohibited.' },
      { heading: 'Products and pricing', text: 'We make reasonable efforts to keep product descriptions, images, sizes, colors, and availability accurate. Colors may vary slightly depending on your display settings. Prices and offers may change, subject to applicable law; applicable charges will be shown before you place an order.' },
      { heading: 'Orders', text: 'Orders are subject to confirmation and product availability. DUSKEO may contact you about your order, including to clarify information or notify you of an issue.' },
      { heading: 'Payments', text: 'Payment must be completed using a payment method offered at checkout. An order may be cancelled if payment is unsuccessful or fraudulent activity is reasonably suspected. Any applicable refund will be handled under the Refund Policy and applicable law.' },
      { heading: 'Intellectual property', text: 'DUSKEO branding, logos, website content, images, and original designs may not be copied or used without authorization, except as permitted by law.' },
      { heading: 'Liability and legal rights', text: 'Nothing in these terms excludes or limits any right, remedy, or protection that cannot lawfully be excluded or limited under applicable Indian law.' },
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
  "Last updated: 8 November 2026. The grievance officer and business address details below must be completed before publication. Customer rights under applicable Indian law are not limited by these policies."
