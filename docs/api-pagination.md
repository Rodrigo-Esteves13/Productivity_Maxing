# List endpoints: accepted query parameters

Applies to `GET /tasks`, `GET /notebook/entries` and `GET /notebook/entry-summaries`.

The API validates the whole query string with a whitelist. Any query parameter not listed
below is rejected with `400 Bad Request` (for example `?foo=1` or a misspelled `?limt=10`).
This also applies to API-key clients. Remove unknown parameters instead of expecting them
to be ignored.

| Parameter   | Endpoints                     | Type    | Notes |
|-------------|-------------------------------|---------|-------|
| `limit`     | all three                     | integer | Page size, 1 to 200. |
| `cursor`    | all three                     | string  | `nextCursor` of the previous page, at most 64 characters. An unknown, deleted or foreign cursor answers 400 `Invalid cursor`. |
| `paginated` | all three                     | boolean | `true` or `false`. `true` returns `{ items, nextCursor }` from the first page, which is how you obtain the first cursor. |
| `periodId`  | `GET /tasks` only             | string  | Omitted = active period, `all` = every period, or a period id. |
| `areaId`    | notebook endpoints only (required) | UUID | Area to list. A missing or non-UUID value answers 400. |

## Response shape

- Without `cursor` and `paginated`, the response is a plain array, capped at 1000 items. When
  the cap cuts the list, the response carries the header `X-Result-Truncated`.
- With `cursor` or `paginated=true`, the response is `{ items, nextCursor }`. `nextCursor` is
  `null` on the last page.
