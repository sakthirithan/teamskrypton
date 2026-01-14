// Phone number validation utilities

export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  error?: string;
}

// Country codes with their dial codes and expected lengths
const COUNTRY_CONFIGS = {
  IN: { dialCode: '+91', minLength: 10, maxLength: 10, name: 'India' },
  US: { dialCode: '+1', minLength: 10, maxLength: 10, name: 'United States' },
  UK: { dialCode: '+44', minLength: 10, maxLength: 11, name: 'United Kingdom' },
} as const;

export type CountryCode = keyof typeof COUNTRY_CONFIGS;

/**
 * Validates and formats a phone number
 * @param phone - The phone number to validate
 * @param countryCode - Country code (default: 'IN' for India)
 */
export function validatePhoneNumber(
  phone: string, 
  countryCode: CountryCode = 'IN'
): PhoneValidationResult {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Get country config
  const config = COUNTRY_CONFIGS[countryCode];
  
  // Check if empty
  if (!digitsOnly) {
    return { isValid: true, formatted: '', error: undefined }; // Empty is valid (optional field)
  }
  
  // Remove country code if present at start
  let cleanNumber = digitsOnly;
  if (countryCode === 'IN' && cleanNumber.startsWith('91') && cleanNumber.length > 10) {
    cleanNumber = cleanNumber.substring(2);
  } else if (countryCode === 'US' && cleanNumber.startsWith('1') && cleanNumber.length > 10) {
    cleanNumber = cleanNumber.substring(1);
  } else if (countryCode === 'UK' && cleanNumber.startsWith('44') && cleanNumber.length > 10) {
    cleanNumber = cleanNumber.substring(2);
  }
  
  // Validate length
  if (cleanNumber.length < config.minLength) {
    return { 
      isValid: false, 
      formatted: phone,
      error: `Phone number must be at least ${config.minLength} digits`
    };
  }
  
  if (cleanNumber.length > config.maxLength) {
    return { 
      isValid: false, 
      formatted: phone,
      error: `Phone number must not exceed ${config.maxLength} digits`
    };
  }
  
  // Check for all same digits (invalid pattern)
  if (/^(\d)\1+$/.test(cleanNumber)) {
    return {
      isValid: false,
      formatted: phone,
      error: 'Invalid phone number pattern'
    };
  }
  
  // Format with country code
  const formatted = `${config.dialCode} ${cleanNumber}`;
  
  return { isValid: true, formatted, error: undefined };
}

/**
 * Formats a phone number for display
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '-';
  
  // Clean the number
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it's a 10-digit Indian number, format it nicely
  if (digitsOnly.length === 10) {
    return `+91 ${digitsOnly.substring(0, 5)} ${digitsOnly.substring(5)}`;
  }
  
  // If it already has country code
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const number = digitsOnly.substring(2);
    return `+91 ${number.substring(0, 5)} ${number.substring(5)}`;
  }
  
  // Return as-is if format is unknown
  return phone;
}

/**
 * Extracts just the digits from a phone number
 */
export function extractDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}
