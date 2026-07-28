type GoogleSheetProduct = {
  id: string;
  barcode: string;
  name: string;
  unit: string;
};

type GoogleSheetLine = {
  productId: string;
  quantity: number;
  updatedAt: string;
};

type GoogleSheetSession = {
  id: string;
  startedAt: string;
  completedAt?: string;
  lines: GoogleSheetLine[];
};

export const extractSpreadsheetId = (url: string) =>
  url.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? "";

export const isGoogleAppsScriptUrl = (url: string) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9-_]+\/exec(?:\?.*)?$/.test(url.trim());

export const googleSheetTabName = (startedAt: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(startedAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `KIỂM KHO - ${value("day")}-${value("month")}-${value("year")}`;
};

export async function sendSessionToGoogleSheet({
  sheetUrl,
  scriptUrl,
  sharedSecret,
  session,
  products,
}: {
  sheetUrl: string;
  scriptUrl: string;
  sharedSecret: string;
  session: GoogleSheetSession;
  products: GoogleSheetProduct[];
}) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) throw new Error("Link Google Sheet không hợp lệ.");
  if (!isGoogleAppsScriptUrl(scriptUrl)) throw new Error("Link Apps Script Web App không hợp lệ.");
  if (sharedSecret.trim().length < 24) throw new Error("Shared secret phải có ít nhất 24 ký tự.");

  const productById = new Map(products.map((product) => [product.id, product]));
  const rows = session.lines.map((line, index) => {
    const product = productById.get(line.productId);
    return [
      index + 1,
      product?.barcode ?? "",
      product?.name ?? "Không xác định",
      product?.unit ?? "",
      line.quantity,
      line.updatedAt,
    ];
  });

  await fetch(scriptUrl.trim(), {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      spreadsheetId,
      sharedSecret: sharedSecret.trim(),
      sessionId: session.id,
      sheetName: googleSheetTabName(session.startedAt),
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? "",
      rows,
    }),
  });
}
