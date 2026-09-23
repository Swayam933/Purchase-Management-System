import { Validator, isPlainObject } from './validate.js';
import { badRequest } from '../utils/AppError.js';

/** POST/PUT /api/item-types */
export function validateItemTypePayload(body) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const v = new Validator();
  const typeName = v.string(body.typeName ?? body.type_name ?? body.name, 'typeName', {
    max: 100,
    message: 'Item type name is required',
    label: 'Item type name',
  });
  v.throwIfInvalid();

  return { typeName };
}
