/**
 * Every successful response shares one envelope so the frontend can unwrap it
 * in a single place:
 *
 *   { "success": true, "meta": { ... }, "data": ... }
 */

export const ok = (res, data, meta = null) =>
  res.status(200).json({ success: true, ...(meta ? { meta } : {}), data });

export const created = (res, data) => res.status(201).json({ success: true, data });

export const noContent = (res) => res.status(204).send();
