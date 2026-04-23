/** Query params preserved when paginating the public events catalogue. */
export type EventsCatalogQueryParams = {
  q?: string;
  type?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: string;
};

export function buildEventsCatalogQueryString(
  params: EventsCatalogQueryParams,
  page: number
): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.type) qs.set("type", params.type);
  if (params.city) qs.set("city", params.city);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.size) qs.set("size", params.size);
  qs.set("page", String(page));
  return qs.toString();
}
