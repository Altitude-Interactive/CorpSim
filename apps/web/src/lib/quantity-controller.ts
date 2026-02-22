export interface QuantityFormatOptions {
  prefix?: string;
  fallback?: string;
  locale?: string;
}

export class QuantityController {
  format(quantity: number, options?: QuantityFormatOptions): string {
    const prefix = options?.prefix ?? "x";
    const fallback = options?.fallback ?? "--";

    if (!Number.isFinite(quantity)) {
      return fallback;
    }

    return `${prefix}${quantity.toLocaleString(options?.locale)}`;
  }
}

const quantityController = new QuantityController();

export function getQuantityController(): QuantityController {
  return quantityController;
}

export function formatQuantityToken(quantity: number, options?: QuantityFormatOptions): string {
  return quantityController.format(quantity, options);
}
