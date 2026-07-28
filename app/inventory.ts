export type InventoryLine = {
  productId: string;
  quantity: number;
  updatedAt: string;
};

export const parseInventoryQuantity = (value: string) =>
  Number(value.trim().replace(",", "."));

export function setInventoryQuantity(
  lines: InventoryLine[],
  productId: string,
  quantity: number,
  updatedAt: string,
) {
  const exists = lines.some((line) => line.productId === productId);
  if (!exists) return [...lines, { productId, quantity, updatedAt }];
  return lines.map((line) =>
    line.productId === productId ? { ...line, quantity, updatedAt } : line,
  );
}

export const shouldExportBeforeCompleting = (
  sessionId: string,
  lineCount: number,
  exportedSessionId: string,
) => lineCount > 0 && exportedSessionId !== sessionId;
