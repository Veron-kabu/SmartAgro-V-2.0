export const ROLES = Object.freeze({
  buyer: 'buyer',
  farmer: 'farmer',
  admin: 'admin',
});

// Role display names
export const ROLE_NAMES = Object.freeze({
  [ROLES.buyer]: 'Buyer',
  [ROLES.farmer]: 'Farmer',
  [ROLES.admin]: 'Admin',
});

// Role descriptions for sign-up
export const ROLE_DESCRIPTIONS = Object.freeze({
  [ROLES.buyer]: 'I want to purchase fresh produce and connect with local farmers',
  [ROLES.farmer]: 'I want to sell my produce and manage my agricultural business',
});

// Only buyer and farmer can be selected during sign-up
export const SELECTABLE_ROLES = [ROLES.buyer, ROLES.farmer];
