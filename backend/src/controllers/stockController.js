import * as stockService from '../services/stockService.js';
import { parseItemFilters } from '../validators/itemValidator.js';
import { ok } from '../utils/response.js';

export const overview = async (req, res) => {
  const filters = parseItemFilters(req.query);
  const { summary, items } = await stockService.overview(filters);
  ok(res, { summary, items }, { count: items.length, filters });
};
