import * as itemTypeService from '../services/itemTypeService.js';
import { validateItemTypePayload } from '../validators/itemTypeValidator.js';
import { parseId } from '../validators/validate.js';
import { created, ok } from '../utils/response.js';

export const list = async (req, res) => {
  const data = await itemTypeService.list();
  ok(res, data, { count: data.length });
};

export const getById = async (req, res) => {
  ok(res, await itemTypeService.getById(parseId(req.params.id, 'item type id')));
};

export const create = async (req, res) => {
  const payload = validateItemTypePayload(req.body);
  created(res, await itemTypeService.create(payload));
};

export const update = async (req, res) => {
  const id = parseId(req.params.id, 'item type id');
  const payload = validateItemTypePayload(req.body);
  ok(res, await itemTypeService.update(id, payload));
};

export const remove = async (req, res) => {
  const id = parseId(req.params.id, 'item type id');
  ok(res, await itemTypeService.remove(id));
};
