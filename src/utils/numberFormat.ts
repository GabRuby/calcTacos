export const formatQuantity = (quantity: number): string => {
  // Comprobar si la cantidad es un número entero (sin decimales)
  if (quantity % 1 === 0) {
    return quantity.toString();
  } else {
    // Si tiene decimales, redondear a dos decimales y devolver como cadena
    return quantity.toFixed(2);
  }
}; 