# API Reference

Base URL: `http://localhost:3000/api`

All requests and responses are JSON. No authentication is required (see the
security note in the [README](../README.md#security-note)).

## Response envelope

Success:

```json
{
  "success": true,
  "meta": { "count": 8 },
  "data": [ ... ]
}
```

`meta` is present on list endpoints only.

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "name", "message": "Item name is required" }
    ]
  }
}
```

`details` is present when the failure can be attributed to specific fields. The
frontend uses `details[].field` to place messages under the matching input.

## Status codes

| Status | Code                | Used for                                                                 |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| 200    | –                   | Successful read, update or delete                                        |
| 201    | –                   | Resource created                                                         |
| 400    | `VALIDATION_ERROR`  | Missing/invalid fields, bad query parameters, invalid id                  |
| 400    | `MALFORMED_JSON`    | Request body is not valid JSON                                           |
| 404    | `NOT_FOUND`         | Item, item type or purchase does not exist                               |
| 404    | `ROUTE_NOT_FOUND`   | Unknown route                                                            |
| 405    | `METHOD_NOT_ALLOWED`| `DELETE /api/purchases/:id` — purchases cannot be deleted                 |
| 409    | `CONFLICT`          | Insufficient stock, inactive item, duplicate name/order id, delete blocked |
| 500    | `INTERNAL_ERROR`    | Unexpected failure (details are logged server side, never returned)      |
| 503    | `DATABASE_UNAVAILABLE` | MySQL connection or required table is unavailable                     |

---

## Health

### `GET /api/health`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 42,
    "storage": "mysql",
    "lowStockThreshold": 5,
    "records": { "itemTypes": 5, "items": 8, "purchases": 1, "purchaseItems": 3 }
  }
}
```

---

## Item Types

### `GET /api/item-types`

Returns every type with usage counts (a `LEFT JOIN items` + `GROUP BY`
equivalent), sorted by name.

```json
{
  "success": true,
  "meta": { "count": 5 },
  "data": [
    {
      "id": 3,
      "typeName": "Clothing",
      "itemCount": 1,
      "activeItemCount": 1,
      "createdAt": "2026-09-24T09:00:00.000Z",
      "updatedAt": "2026-09-24T09:00:00.000Z"
    }
  ]
}
```

### `GET /api/item-types/:id`

`404` when the type does not exist.

### `POST /api/item-types`

```json
{ "typeName": "Hardware" }
```

| Rule                    | Failure                                     |
| ----------------------- | ------------------------------------------- |
| `typeName` required     | `400` *Item type name is required*          |
| max 100 characters      | `400`                                       |
| unique (case-insensitive) | `409` *Item type "Hardware" already exists* |

### `PUT /api/item-types/:id`

Same body and rules as `POST`.

### `DELETE /api/item-types/:id`

Blocked while items reference the type.

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Item type \"Electronics\" is used by 5 item(s) and cannot be deleted"
  }
}
```

---

## Items

### `GET /api/items`

Item master joined to its type.

| Query          | Values                                          | Notes                                  |
| -------------- | ----------------------------------------------- | -------------------------------------- |
| `q`            | text                                            | Matches item name or type name         |
| `itemTypeId`   | integer                                         |                                        |
| `active`       | `true` \| `false` \| `all`                      | `all` (or omitted) returns both        |
| `availability` | `in_stock` \| `low_stock` \| `out_of_stock` \| `all` | `in_stock` includes low stock     |

```json
{
  "success": true,
  "meta": { "count": 1, "filters": { "active": true } },
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "itemTypeId": 1,
      "itemTypeName": "Electronics",
      "purchaseDate": "2026-08-25",
      "stockAvailable": 8,
      "availability": { "status": "in_stock", "label": "In Stock" },
      "active": true,
      "status": "Active",
      "createdAt": "2026-09-24T09:00:00.000Z",
      "updatedAt": "2026-09-24T09:12:00.000Z"
    }
  ]
}
```

### `GET /api/items/:id`

Adds the item's purchase history and whether it may be deleted.

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Laptop",
    "itemTypeName": "Electronics",
    "stockAvailable": 8,
    "availability": { "status": "in_stock", "label": "In Stock" },
    "active": true,
    "purchaseHistory": [
      { "purchaseId": 1, "orderId": "PO-00001", "purchaseDate": "2026-08-25", "quantity": 2 }
    ],
    "totalPurchased": 2,
    "canDelete": false
  }
}
```

### `POST /api/items`

```json
{
  "name": "Laptop",
  "itemTypeId": 1,
  "purchaseDate": "2026-08-25",
  "stockAvailable": 10,
  "active": true
}
```

| Field            | Rules                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `name`           | Required, ≤ 150 chars, unique → `409`                              |
| `itemTypeId`     | Required, must exist → `400` *Invalid item type*                    |
| `purchaseDate`   | Required, `YYYY-MM-DD`, must be a real calendar date                |
| `stockAvailable` | Required integer ≥ 0 → `400` *Stock cannot be negative*             |
| `active`         | Optional boolean, defaults to `true`                               |

### `PUT /api/items/:id`

Full update, same body and rules as `POST`. Editing `stockAvailable` here
changes the item master directly; it is not a purchase.

### `PATCH /api/items/:id/status`

```json
{ "active": false }
```

Inactive items remain visible in purchase history but cannot be added to new
purchases.

### `DELETE /api/items/:id`

Permitted only when the item has never been purchased.

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "\"Laptop\" appears in 1 purchase(s) and cannot be deleted. Mark it inactive instead."
  }
}
```

---

## Purchases

### `GET /api/purchases`

| Query  | Values       | Notes                     |
| ------ | ------------ | ------------------------- |
| `q`    | text         | Matches the Order ID      |
| `from` | `YYYY-MM-DD` | Purchase date lower bound |
| `to`   | `YYYY-MM-DD` | Purchase date upper bound |

```json
{
  "success": true,
  "meta": { "count": 1 },
  "data": [
    {
      "id": 1,
      "orderId": "PO-00001",
      "purchaseDate": "2026-08-25",
      "lineCount": 3,
      "totalQuantity": 10,
      "createdAt": "2026-09-24T09:10:00.000Z",
      "updatedAt": "2026-09-24T09:10:00.000Z"
    }
  ]
}
```

### `GET /api/purchases/next-order-id`

The Order ID the next created purchase will receive, so the form can display it.

```json
{ "success": true, "data": { "orderId": "PO-00002" } }
```

### `GET /api/purchases/:id`

Purchase header plus its lines, joined across purchases → purchase_items →
items → item_types. Inactive items still resolve here so history stays readable.

```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderId": "PO-00001",
    "purchaseDate": "2026-08-25",
    "lineCount": 3,
    "totalQuantity": 10,
    "items": [
      {
        "purchaseItemId": 1,
        "itemId": 1,
        "itemName": "Laptop",
        "itemTypeId": 1,
        "itemTypeName": "Electronics",
        "itemActive": true,
        "quantity": 2,
        "currentStock": 8,
        "availability": { "status": "in_stock", "label": "In Stock" }
      }
    ],
    "createdAt": "2026-09-24T09:10:00.000Z",
    "updatedAt": "2026-09-24T09:10:00.000Z"
  }
}
```

### `POST /api/purchases`

```json
{
  "orderId": "PO-00001",
  "purchaseDate": "2026-08-25",
  "items": [
    { "itemId": 1, "quantity": 2 },
    { "itemId": 2, "quantity": 5 },
    { "itemId": 3, "quantity": 3 }
  ]
}
```

`orderId` is optional — omit it and the next `PO-#####` is assigned.

Processed as one atomic unit: every line is validated first, then the purchase,
its lines and the stock deductions are written together. Any failure leaves the
data exactly as it was.

| Rule                          | Failure                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `purchaseDate` required/valid | `400`                                                                         |
| ≥ 1 line                      | `400` *Purchase must contain at least one item*                               |
| `quantity` integer > 0        | `400` *Quantity must be greater than zero*                                    |
| No duplicate `itemId`         | `400` *Duplicate item in order: this item is already on line N*               |
| Item exists                   | `404` *Item not found: no item with id 42*                                    |
| Item active                   | `409` *Item is inactive and cannot be purchased: "Legacy Printer"*            |
| Stock sufficient              | `409` *Insufficient stock for "Laptop". Requested 15, available 10.*          |
| `orderId` unique              | `409` *Order ID "PO-00001" already exists*                                    |

Returns `201` with the same shape as `GET /api/purchases/:id`.

### `PUT /api/purchases/:id`

```json
{
  "purchaseDate": "2026-08-27",
  "items": [
    { "itemId": 1, "quantity": 5 },
    { "itemId": 2, "quantity": 5 }
  ]
}
```

Both fields are optional; supply at least one. When `items` is present it is the
**complete new line set** for the order, and stock is reconciled by the
difference per item:

| Change                     | Stock effect                          |
| -------------------------- | ------------------------------------- |
| quantity 3 → 5             | Deduct 2 more                         |
| quantity 5 → 2             | Return 3                              |
| line removed               | Return the full quantity              |
| line added                 | Deduct the new quantity               |

An inactive item may be reduced or removed but never increased or newly added.
Validation runs before anything is written, so a rejected update changes nothing.

### `DELETE /api/purchases/:id`

Always refused.

```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Purchases are historical transactions and cannot be deleted. Update the purchase instead."
  }
}
```

The route exists solely to return this explicit answer; there is no deletion
code path behind it, and the service layer exposes no delete function.

---

## Stock

### `GET /api/stock`

Accepts the same filters as `GET /api/items`. Counts in `summary` always
describe the whole catalogue so the dashboard cards stay stable while filtering.

```json
{
  "success": true,
  "meta": { "count": 8 },
  "data": {
    "summary": {
      "totalItems": 8,
      "activeItems": 7,
      "inactiveItems": 1,
      "inStock": 5,
      "lowStock": 2,
      "outOfStock": 1,
      "totalUnits": 72,
      "lowStockThreshold": 5
    },
    "items": [ /* same shape as GET /api/items */ ]
  }
}
```

Availability rules: `> 0` In Stock, `= 0` Out of Stock, `≤ LOW_STOCK_THRESHOLD`
Low Stock.

---

## Examples

```bash
# List items with their type
curl http://localhost:3000/api/items

# Only active items that still have stock (what the purchase form uses)
curl "http://localhost:3000/api/items?active=true"

# Create an item
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Monitor","itemTypeId":1,"purchaseDate":"2026-09-24","stockAvailable":12,"active":true}'

# Create a purchase with three items, letting the server assign the Order ID
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"purchaseDate":"2026-08-25","items":[{"itemId":1,"quantity":2},{"itemId":2,"quantity":5},{"itemId":3,"quantity":3}]}'

# Rejected: more than the available stock
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"purchaseDate":"2026-08-26","items":[{"itemId":1,"quantity":10}]}'

# Update quantities (stock adjusts by the difference)
curl -X PUT http://localhost:3000/api/purchases/1 \
  -H "Content-Type: application/json" \
  -d '{"items":[{"itemId":1,"quantity":5},{"itemId":2,"quantity":5}]}'

# Refused with 405
curl -X DELETE http://localhost:3000/api/purchases/1
```

A ready-to-import Postman collection is available at
[`postman_collection.json`](./postman_collection.json).
