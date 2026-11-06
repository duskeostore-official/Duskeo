/** localStorage / sessionStorage keys (same as the original site). */
export const STORAGE_KEYS = {
  inventory: 'duskeo_size_inventory_v1',
  catalogCustom: 'duskeo_catalog_custom_v1',
  catalogDeleted: 'duskeo_catalog_deleted_v1',
  restockRequests: 'duskeo_restock_requests_v1',
  adminPasscode: 'duskeo_admin_passcode_v1',
  adminSession: 'duskeo_admin_session_v1',
  theme: 'duskeo_theme_v1',
  guestBag: 'duskeo_guest_bag_v1',
  /** Last PIN code checked in the size picker. */
  pincode: 'duskeo_pincode_v1',
} as const
