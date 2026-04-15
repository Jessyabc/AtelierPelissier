import { DEFAULT_KITCHEN_MARKUP } from "@/config/kitchenPricingBuilder";

export function isKitchenAdminRole(role: string): boolean {
  return role === "admin";
}

export function isKitchenManagerRole(role: string): boolean {
  return role === "admin" || role === "planner";
}

export function canUserSeeBreakdown(role: string): boolean {
  return isKitchenManagerRole(role);
}

export function canUserChangeMultiplier(role: string): boolean {
  return role === "admin" || role === "planner" || role === "salesperson";
}

export function canUserRequestDiscount(role: string): boolean {
  return role === "admin" || role === "planner" || role === "salesperson";
}

export function requiresManagerReview(multiplier: number): boolean {
  return multiplier !== DEFAULT_KITCHEN_MARKUP;
}
