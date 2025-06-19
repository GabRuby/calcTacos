// src/utils/currencyFormatter.ts

/**
 * Formatea un número como moneda con separadores de miles y dos decimales,
 * según el código de moneda y el locale especificados.
 * @param amount El número a formatear.
 * @param currencyCode El código ISO de la moneda (ej. 'MXN', 'USD', 'EUR'). Por defecto 'MXN'.
 * @param locale El locale a usar para el formato (ej. 'es-MX', 'en-US'). Por defecto 'es-MX'.
 * @returns El número formateado como string (ej. "$1,234.56", "€1.234,56").
 */
export const formatCurrency = (
    amount: number,
    currencyCode: string = 'MXN',
    locale: string = 'es-MX'
  ): string => {
    // Validar el código de moneda
    let safeCurrency = (typeof currencyCode === 'string' && currencyCode.length === 3) ? currencyCode : 'MXN';
    // Asegurarse de que el input sea un número válido
    if (typeof amount !== 'number' || isNaN(amount)) {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: safeCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(0);
      } catch (error) {
        console.error("Error al formatear moneda para valor inválido:", error);
        return "$0.00";
      }
    }
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return formatter.format(amount);
    } catch (error) {
      console.error("Error al formatear moneda:", error);
      return `$${amount.toFixed(2)}`;
    }
  };