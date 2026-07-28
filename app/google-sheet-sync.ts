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

const postWithHiddenForm = (url: string, payload: string) =>
  new Promise<void>((resolve, reject) => {
    try {
      const target = `google-sheet-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const iframe = document.createElement("iframe");
      iframe.name = target;
      iframe.hidden = true;
      iframe.setAttribute("aria-hidden", "true");

      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = target;
      form.hidden = true;

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = payload;
      form.appendChild(input);
      document.body.append(iframe, form);
      form.submit();

      window.setTimeout(() => {
        form.remove();
        iframe.remove();
      }, 10000);
      resolve();
    } catch (error) {
      reject(error);
    }
  });

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

  await postWithHiddenForm(
    scriptUrl.trim(),
    JSON.stringify({
      spreadsheetId,
      sharedSecret: sharedSecret.trim(),
      sessionId: session.id,
      sheetName: googleSheetTabName(session.startedAt),
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? "",
      rows,
    }),
  );
}
