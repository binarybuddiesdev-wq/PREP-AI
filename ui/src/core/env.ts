export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? '';

export const CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
export const IS_CLERK_CONFIGURATION_VALID = /^pk_(test|live)_[A-Za-z0-9_-]+$/.test(
  clerkPublishableKey
);
