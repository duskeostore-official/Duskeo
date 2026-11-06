-- =====================================================================
--  004: remove the old dashboard-made checkout kept aside by 003
--  (legacy.orders, legacy.order_items: 3 test COD orders from 4 Nov 2026).
--  Orders now live in public.orders / public.order_items (Hybrid design).
-- =====================================================================
drop schema if exists legacy cascade;
