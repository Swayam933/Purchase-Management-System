import { badRequest } from '../utils/AppError.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Strict calendar check: rejects 2026-02-30, 2026-13-01, etc. */
export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Collects every field problem in one pass so the API can answer with a
 * complete list instead of failing on the first bad field.
 *
 *   const v = new Validator();
 *   const name = v.string(body.name, 'name', { message: 'Item name is required' });
 *   v.throwIfInvalid();
 */
export class Validator {
  #errors = [];

  get errors() {
    return this.#errors;
  }

  get hasErrors() {
    return this.#errors.length > 0;
  }

  fail(field, message) {
    this.#errors.push({ field, message });
    return undefined;
  }

  throwIfInvalid(message = 'Validation failed') {
    if (this.hasErrors) throw badRequest(message, this.#errors);
  }

  /** Required (by default) trimmed string. */
  string(value, field, { required = true, min = 1, max = 255, message, label = field } = {}) {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      if (!required) return undefined;
      return this.fail(field, message ?? `${label} is required`);
    }
    if (typeof value !== 'string') {
      return this.fail(field, `${label} must be text`);
    }
    const trimmed = value.trim();
    if (trimmed.length < min) {
      return this.fail(field, `${label} must be at least ${min} characters`);
    }
    if (trimmed.length > max) {
      return this.fail(field, `${label} must be ${max} characters or fewer`);
    }
    return trimmed;
  }

  /** Required (by default) integer with optional bounds. */
  integer(
    value,
    field,
    { required = true, min, max, message, tooSmallMessage, label = field } = {},
  ) {
    if (value === undefined || value === null || value === '') {
      if (!required) return undefined;
      return this.fail(field, message ?? `${label} is required`);
    }
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return this.fail(field, `${label} must be a whole number`);
    }
    if (min !== undefined && parsed < min) {
      return this.fail(field, tooSmallMessage ?? `${label} must be ${min} or greater`);
    }
    if (max !== undefined && parsed > max) {
      return this.fail(field, `${label} must be ${max} or less`);
    }
    return parsed;
  }

  /** Required (by default) `YYYY-MM-DD` date. Accepts full ISO timestamps too. */
  date(value, field, { required = true, message, label = field } = {}) {
    if (value === undefined || value === null || value === '') {
      if (!required) return undefined;
      return this.fail(field, message ?? `${label} is required`);
    }
    const candidate = typeof value === 'string' ? value.trim().slice(0, 10) : value;
    if (!isValidIsoDate(candidate)) {
      return this.fail(field, `${label} must be a valid date in YYYY-MM-DD format`);
    }
    return candidate;
  }

  /** Optional boolean. Accepts real booleans plus the usual string/number forms. */
  boolean(value, field, { required = false, defaultValue, label = field } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) return this.fail(field, `${label} is required`);
      return defaultValue;
    }
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'active'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'inactive'].includes(normalized)) return false;
    return this.fail(field, `${label} must be true or false`);
  }

  /** Required non-empty array. */
  array(value, field, { min = 1, max = 200, message, label = field } = {}) {
    if (!Array.isArray(value) || value.length < min) {
      return this.fail(field, message ?? `${label} must contain at least ${min} entry`);
    }
    if (value.length > max) {
      return this.fail(field, `${label} cannot contain more than ${max} entries`);
    }
    return value;
  }
}

/** Parses a `:id` style route/query parameter. Throws 400 on anything invalid. */
export function parseId(value, label = 'id') {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`Invalid ${label}`, [{ field: label, message: `${label} must be a positive integer` }]);
  }
  return parsed;
}
