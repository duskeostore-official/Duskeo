create unique index payu_one_created_attempt_per_order
  on public.payments (order_id)
  where provider = 'payu' and status = 'created';

comment on index public.payu_one_created_attempt_per_order is
  'Prevents multiple active PayU transactions from being started for the same order.';

comment on column public.payments.provider is
  'Payment gateway provider, including payu, razorpay, cashfree, phonepe, and courier_cod.';
