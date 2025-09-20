// Role constants for user management
export const ROLES = {
  BUYER: "buyer",
  FARMER: "farmer",
  ADMIN: "admin",
}

// Roles that users can switch between (excluding admin)
export const SWITCHABLE_ROLES = [ROLES.BUYER, ROLES.FARMER]

// All valid roles
export const ALL_ROLES = Object.values(ROLES)

// Role permissions
export const ROLE_PERMISSIONS = {
  [ROLES.BUYER]: ["create_orders", "view_products", "add_favorites", "send_messages", "view_own_orders"],
  [ROLES.FARMER]: [
    "create_products",
    "manage_products",
    "view_orders",
    "update_order_status",
    "send_messages",
    "view_dashboard",
  ],
  [ROLES.ADMIN]: ["manage_users", "manage_products", "manage_orders", "view_analytics", "moderate_content"],
}

export function hasPermission(userRole, permission) {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false
}

export function isValidRole(role) {
  return ALL_ROLES.includes(role)
}
