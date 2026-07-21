const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ.' -]+$/;
const ADDRESS_REGEX = /^[A-Za-z0-9À-ÖØ-öø-ÿÑñ.,'#/() -]+$/;
const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;
const POSTAL_CODE_REGEX = /^\d{4}$/;
const REGION_DESIGNATION_REGEX = /^[A-Za-z0-9 -]{1,20}$/;
const ALLOWED_SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"];

const cleanText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const toTitleCase = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/(^|[\s'-])([\p{L}])/gu, (_, separator, letter) => {
      return `${separator}${letter.toUpperCase()}`;
    });

const normalizeNullable = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

const normalizeNamePart = (value) => {
  const cleaned = cleanText(value);
  return cleaned ? toTitleCase(cleaned) : null;
};

const validateNamePart = (
  value,
  fieldName,
  { required = false, maxLength = 50 } = {},
) => {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return required ? `${fieldName} is required.` : null;
  }

  if (cleaned.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters.`;
  }

  if (!NAME_REGEX.test(cleaned)) {
    return `${fieldName} may only contain letters, spaces, apostrophes, periods, and hyphens.`;
  }

  return null;
};

const validateSuffix = (value) => {
  const cleaned = cleanText(value);

  if (!cleaned) return null;

  if (!ALLOWED_SUFFIXES.includes(cleaned)) {
    return "Please select a valid suffix.";
  }

  return null;
};

const validateAddressPart = (
  value,
  fieldName,
  { required = false, maxLength = 100, lettersOnly = false } = {},
) => {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return required ? `${fieldName} is required.` : null;
  }

  if (cleaned.length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters.`;
  }

  const regex = lettersOnly ? NAME_REGEX : ADDRESS_REGEX;

  if (!regex.test(cleaned)) {
    return `${fieldName} contains invalid characters.`;
  }

  return null;
};

const validatePostalCode = (value, required = true) => {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return required ? "Postal code is required." : null;
  }

  if (!POSTAL_CODE_REGEX.test(cleaned)) {
    return "Postal code must contain exactly four digits.";
  }

  return null;
};

const validatePhoneNumber = (value, required = false) => {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return required ? "Phone number is required." : null;
  }

  if (!PHONE_REGEX.test(cleaned)) {
    return "Phone number must use 09XXXXXXXXX or +639XXXXXXXXX format.";
  }

  return null;
};

const validateSeparatedNameFields = (data = {}) => {
  const errors = {};

  const checks = [
    ["first_name", data.first_name, "First name", true, 50],
    ["middle_name", data.middle_name, "Middle name", false, 50],
    ["last_name", data.last_name, "Last name", true, 50],
  ];

  for (const [key, value, label, required, maxLength] of checks) {
    const error = validateNamePart(value, label, { required, maxLength });
    if (error) errors[key] = error;
  }

  const suffixError = validateSuffix(data.suffix);
  if (suffixError) errors.suffix = suffixError;

  return errors;
};

const validatePatientAddressFields = (data = {}) => {
  const errors = {};

  const regionDesignation = cleanText(data.region_designation);

  if (!REGION_DESIGNATION_REGEX.test(regionDesignation)) {
    errors.region_designation = "Please select a valid Philippine region.";
  }

  const checks = [
    [
      "house_unit_number",
      data.house_unit_number,
      "House or unit number",
      false,
      30,
      false,
    ],
    ["street_name", data.street_name, "Street name", false, 100, false],
    [
      "subdivision",
      data.subdivision,
      "Subdivision or village",
      false,
      100,
      false,
    ],
    ["barangay", data.barangay, "Barangay", true, 100, true],
    [
      "city_municipality",
      data.city_municipality,
      "City or municipality",
      true,
      100,
      true,
    ],
    ["province", data.province, "Province", true, 100, true],
    ["region", data.region, "Region", true, 100, true],
    ["country", data.country || "Philippines", "Country", true, 50, true],
  ];

  for (const [key, value, label, required, maxLength, lettersOnly] of checks) {
    const error = validateAddressPart(value, label, {
      required,
      maxLength,
      lettersOnly,
    });

    if (error) errors[key] = error;
  }

  const postalCodeError = validatePostalCode(data.postal_code);
  if (postalCodeError) errors.postal_code = postalCodeError;

  const phoneError = validatePhoneNumber(data.contact_number);
  if (phoneError) errors.contact_number = phoneError;

  return errors;
};

const buildFullName = ({ first_name, middle_name, last_name, suffix }) =>
  [first_name, middle_name, last_name, suffix]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

const buildFullAddress = ({
  house_unit_number,
  street_name,
  subdivision,
  barangay,
  city_municipality,
  province,
  region,
  postal_code,
  country,
}) =>
  [
    house_unit_number,
    street_name,
    subdivision,
    barangay,
    city_municipality,
    province,
    region,
    postal_code,
    country || "Philippines",
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");

module.exports = {
  ALLOWED_SUFFIXES,
  cleanText,
  normalizeNullable,
  normalizeNamePart,
  validateNamePart,
  validateSuffix,
  validateAddressPart,
  validatePostalCode,
  validatePhoneNumber,
  validateSeparatedNameFields,
  validatePatientAddressFields,
  buildFullName,
  buildFullAddress,
};
