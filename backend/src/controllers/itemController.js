import * as itemService from '../services/itemService.js';
import {
  parseItemFilters,
  validateItemPayload,
  validateStatusPayload,
} from '../validators/itemValidator.js';
import { parseId } from '../validators/validate.js';
import { created, ok } from '../utils/response.js';

export const list = async (req, res) => {
  const filters = parseItemFilters(req.query);
  const data = await itemService.list(filters);
  ok(res, data, { count: data.length, filters });
};

export const getById = async (req, res) => {
  ok(res, await itemService.getById(parseId(req.params.id, 'item id')));
};

export const create = async (req, res) => {
  const payload = validateItemPayload(req.body);
  created(res, await itemService.create(payload));
};

export const update = async (req, res) => {
  const id = parseId(req.params.id, 'item id');
  const payload = validateItemPayload(req.body);
  ok(res, await itemService.update(id, payload));
};

/** Activate / deactivate without resubmitting the whole item. */
export const updateStatus = async (req, res) => {
  const id = parseId(req.params.id, 'item id');
  const { active } = validateStatusPayload(req.body);
  ok(res, await itemService.setActive(id, active));
};

export const remove = async (req, res) => {
  const id = parseId(req.params.id, 'item id');
  ok(res, await itemService.remove(id));
};
