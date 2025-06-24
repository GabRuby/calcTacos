// src/utils/newReport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDailySalesReport } from './dailySales';
import { BusinessConfig, MenuItem, DailySale } from '../types';
import { getMenu } from './menu';
import { formatCurrency } from './currencyFormatter';
import { formatQuantity } from './numberFormat';
import * as XLSX from 'xlsx'; // Aunque no se use en el PDF, se incluye por si acaso
import { useAlert } from '../contexts/AlertContext';

interface ReportConfig {
  type: 'all' | 'topN';
  nProducts?: number;
  sortOrder: 'menu' | 'sales';
}

interface OtherProductsGroup {
  name: string;
  quantity: number;
  total: number;
  cost: number;
  profit: number;
  profitability: number;
}

export const generateNewDailyReport = async (
  config: BusinessConfig,
  reportConfig: ReportConfig,
  showAlert: (msg: string) => void
) => {
  console.log('Generando reporte con config:', config);
  console.log('Report config:', reportConfig);
  
  const { date, sales, total, products } = getDailySalesReport();
  console.log('Datos del reporte:', { date, sales: sales.length, total, products: products.length });
  
  // Verificar si hay datos para mostrar
  if (products.length === 0) {
    console.log('No hay productos vendidos para mostrar en el reporte');
    showAlert('No hay ventas registradas para generar el reporte. Agrega algunas ventas primero.');
    return;
  }
  
  // Calcular rentabilidad para cada producto basado en el menú
  const menuItems = getMenu();
  console.log('Productos del menú:', menuItems.length);
  
  const productsWithProfitability = products.map(product => {
    const menuItem = menuItems.find(m => m.id === product.id);
    const cost = menuItem ? menuItem.price * 0.6 : 0; // Estimación de costo al 60% del precio
    const profit = product.total - (cost * product.quantity);
    return {
      ...product,
      cost: cost * product.quantity,
      profit: profit,
      profitability: cost > 0 ? profit / (cost * product.quantity) : 0
    };
  });

  console.log('Productos con rentabilidad:', productsWithProfitability.length);

  // Aplicar ordenamiento según la configuración
  let sortedProducts = [...productsWithProfitability];
  if (reportConfig.sortOrder === 'sales') {
    // Ordenar por ingresos por venta (total)
    sortedProducts.sort((a, b) => b.total - a.total);
  } else {
    // Ordenar por orden de registro en el menú (mantener orden original)
    sortedProducts = productsWithProfitability;
  }

  let productsToShow: typeof sortedProducts; // Asegurar el tipo para productsToShow
  let othersGroup: OtherProductsGroup | undefined; // Declarar othersGroup con el nuevo tipo

  switch (reportConfig.type) {
    case 'all':
      productsToShow = sortedProducts;
      break;
    case 'topN':
      const n = reportConfig.nProducts || 6;
      productsToShow = sortedProducts.slice(0, n);
      othersGroup = {
        name: 'Otros',
        quantity: sortedProducts.slice(n).reduce((sum, p) => sum + p.quantity, 0),
        total: sortedProducts.slice(n).reduce((sum, p) => sum + p.total, 0),
        cost: sortedProducts.slice(n).reduce((sum, p) => sum + p.cost, 0),
        profit: sortedProducts.slice(n).reduce((sum, p) => sum + p.profit, 0),
        profitability: 0
      };
      break;
  }

  console.log('Productos a mostrar:', productsToShow.length);
  console.log('Grupo otros:', othersGroup);

  try {
    const doc = new jsPDF('landscape', 'mm', 'letter');
    
    // Agregar logo del negocio si existe
    if (config.imageUrl && config.imageUrl.trim() !== '') {
      try {
        // Convertir la imagen base64 a un objeto Image
        const img = new Image();
        img.src = config.imageUrl;
        
        // Esperar a que la imagen se cargue
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        // Agregar la imagen al PDF (esquina superior izquierda)
        const logoWidth = 30; // Ancho del logo en mm
        const logoHeight = 30; // Alto del logo en mm
        doc.addImage(img, 'PNG', 10, 10, logoWidth, logoHeight);
        
        console.log('Logo agregado al reporte');
      } catch (logoError) {
        console.warn('Error al cargar el logo:', logoError);
        // Continuar sin el logo si hay error
      }
    }
    
    // Configuración del documento
    doc.setFontSize(20);
    doc.text(`${config.name}`, 140, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Reporte de Ventas Diario', 140, 30, { align: 'center' });
    doc.text(`Fecha: ${date}`, 140, 40, { align: 'center' });
    
    // Agregar leyenda antes de la tabla
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Resumen de Ventas del día', 15, 55, { align: 'left' });
    
    // Tabla de productos
    const productNames = productsToShow.map(product => product.name);
    const quantities = productsToShow.map(product => formatQuantity(product.quantity));
    const salesStrings = productsToShow.map(product => formatCurrency(product.total, config.currencyCode));
    
    // Agregar "Otros" si existe
    if (othersGroup) {
      productNames.push(othersGroup.name);
      quantities.push(formatQuantity(othersGroup.quantity));
      salesStrings.push(formatCurrency(othersGroup.total, config.currencyCode));
    }

    // Calcular totales por método de pago
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalTarjeta = 0;

    sales.forEach((sale) => {
      // Usar los campos específicos de pago si están disponibles, de lo contrario usar la lógica basada en el método
      if (sale.cashPart !== undefined) {
        totalEfectivo += sale.cashPart;
      } else if (sale.paymentMethod === 'cash') {
        totalEfectivo += sale.total;
      }
      
      if (sale.transferPart !== undefined) {
        totalTransferencia += sale.transferPart;
      } else if (sale.paymentMethod === 'transfer') {
        totalTransferencia += sale.total;
      }
      
      if (sale.cardPart !== undefined) {
        totalTarjeta += sale.cardPart;
      } else if (sale.paymentMethod === 'card') {
        totalTarjeta += sale.total;
      }
    });

    const tableData = [
      ['Cantidad', ...quantities, 'Efec', 'Transf', 'Tarj', 'Total'],
      ['Ventas', ...salesStrings, formatCurrency(totalEfectivo, config.currencyCode), formatCurrency(totalTransferencia, config.currencyCode), formatCurrency(totalTarjeta, config.currencyCode), formatCurrency(total, config.currencyCode)]
    ];

    console.log('Generando tabla con datos:', tableData.length, 'filas');

    // Calcular ancho total de la tabla en base a la página y márgenes
    const pageTotalWidth = doc.internal.pageSize.getWidth();
    const defaultMargin = 10; // Margen predeterminado de autoTable
    const usableWidth = pageTotalWidth - (defaultMargin * 2); // Ancho útil de la página

    console.log('pageTotalWidth:', pageTotalWidth, 'mm');
    console.log('usableWidth:', usableWidth, 'mm');

    // Anchos fijos basados en porcentajes para las columnas de Resumen y Total
    const resumenWidth = usableWidth * 0.17; // 17% (ajustado para que coincida con Desglose)
    const totalColWidth = usableWidth * 0.10; // 10% (ajustado)

    console.log('resumenWidth:', resumenWidth, 'mm');
    console.log('totalColWidth:', totalColWidth, 'mm');

    // Columnas que necesitan anchos dinámicos (productos + Efec + Transf + Tarj)
    const numberOfProductColumns = productsToShow.length;
    const numberOfPaymentColumns = 3; // Efec, Transf, Tarj
    const numberOfDynamicColumns = numberOfProductColumns + numberOfPaymentColumns;

    // Ancho restante para distribuir entre las columnas dinámicas
    const remainingWidth = usableWidth - resumenWidth - totalColWidth;
    const widthPerDynamicColumn = numberOfDynamicColumns > 0 ? remainingWidth / numberOfDynamicColumns : 0; // Reintroducido

    // Calcular el tamaño de fuente óptimo para los encabezados de producto (Reintegrado)
    let minHeaderFontSize = 7; // Empezar con un tamaño base más pequeño
    const cellPaddingForText = 1; // Ajustado a 1
    const availableWidthForText = widthPerDynamicColumn - (cellPaddingForText * 2); // Ancho disponible para el texto dentro de la celda

    if (numberOfProductColumns > 0) {
      productNames.forEach(productName => {
        for (let size = minHeaderFontSize; size >= 4; size--) { // Probar tamaños de fuente descendentes hasta 4
          doc.setFontSize(size);
          const textWidth = doc.getTextWidth(productName);
          const numberOfLines = Math.ceil(textWidth / availableWidthForText);
          if (numberOfLines <= 2) {
            minHeaderFontSize = Math.min(minHeaderFontSize, size);
            break; // Este tamaño funciona, no necesitamos ir más pequeño para este producto
          }
        }
      });
    }

    // Usar el tamaño de fuente más pequeño requerido para los encabezados en todas las fuentes dinámicas
    let dynamicFontSize = minHeaderFontSize;

    console.log('remainingWidth:', remainingWidth, 'mm');
    console.log('widthPerDynamicColumn:', widthPerDynamicColumn, 'mm');
    console.log('minHeaderFontSize (calculated for products):', minHeaderFontSize, 'pt');

    // Definir estilos de columnas dinámicamente
    const dynamicColumnStyles: { [key: string]: { cellWidth?: number, minCellWidth?: number, fillColor?: [number, number, number] } } = {
      '0': { cellWidth: resumenWidth }, // Columna Resumen (índice 0)
    };

    let currentIndexSummary = 1; // Índice para las columnas de la tabla de resumen
    // Columnas de productos para la tabla de resumen
    for (let i = 0; i < numberOfProductColumns; i++) {
      dynamicColumnStyles[currentIndexSummary.toString()] = { cellWidth: widthPerDynamicColumn }; // Reasignado
      currentIndexSummary++;
    }

    // Columnas de métodos de pago para la tabla de resumen
    dynamicColumnStyles[currentIndexSummary.toString()] = { cellWidth: widthPerDynamicColumn }; // Efec (Reasignado)
    currentIndexSummary++;
    dynamicColumnStyles[currentIndexSummary.toString()] = { cellWidth: widthPerDynamicColumn }; // Transf (Reasignado)
    currentIndexSummary++;
    dynamicColumnStyles[currentIndexSummary.toString()] = { cellWidth: widthPerDynamicColumn }; // Tarj (Reasignado)
    currentIndexSummary++;

    // Columna Total (última columna, índice ajustado)
    dynamicColumnStyles[currentIndexSummary.toString()] = { cellWidth: totalColWidth };

    console.log('dynamicColumnStyles:', dynamicColumnStyles);
    
    // Calcular la suma total de los anchos de columna asignados para la tabla de resumen
    let sumOfColumnWidths = 0;
    for (const key in dynamicColumnStyles) {
        if (dynamicColumnStyles[key].cellWidth) {
            sumOfColumnWidths += dynamicColumnStyles[key].cellWidth || 0;
        }
    }
    console.log('Suma total de anchos de columna (Resumen):', sumOfColumnWidths, 'mm');
    console.log('Ancho útil de la página (usableWidth):', usableWidth, 'mm');

    // Llamada a autoTable para la tabla de resumen
    autoTable(doc, {
      startY: 65,
      head: [['Resumen', ...productNames, 'Efec', 'Transf', 'Tarj', 'Total']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: dynamicFontSize, cellPadding: 1, overflow: 'linebreak', halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [255, 140, 0], fontSize: dynamicFontSize, halign: 'center', valign: 'middle', minCellHeight: 10 },
      footStyles: { fillColor: [255, 140, 0], fontSize: dynamicFontSize },
      columnStyles: dynamicColumnStyles,
      tableWidth: usableWidth // Forzar el ancho total de la tabla para que se ajuste a la página
    });

    // --- Tabla de Desglose de Ventas ---
    let startYDesglose = 0;
    // Comprobar si doc.lastAutoTable y su finalY están disponibles
    if ((doc as any).lastAutoTable && typeof (doc as any).lastAutoTable.finalY === 'number') {
      startYDesglose = (doc as any).lastAutoTable.finalY + 10; // 10mm de espacio después de la tabla de resumen
    } else {
      // Valor de respaldo si finalY de la tabla anterior no está disponible
      startYDesglose = 100; // Un valor predeterminado razonable
      console.warn('No se pudo determinar finalY de la tabla anterior, usando startYDesglose de respaldo:', startYDesglose);
    }
    doc.setFontSize(10);
    doc.text('Desglose de Ventas del día', 15, startYDesglose, { align: 'left' });

    const breakdownProductNames = [...productNames]; // Copiar productNames de la tabla de resumen
    if (othersGroup) {
      breakdownProductNames.push(othersGroup.name); // Añadir 'Otros' si existía en el resumen
    }

    const breakdownTableHead = [['Mesa y Hora', ...breakdownProductNames, 'Efec', 'Transf', 'Tarj', 'Total']];
    const breakdownTableBody: string[][] = [];

    // Inicializar acumuladores para subtotales
    const subtotalCantidad: number[] = new Array(breakdownProductNames.length).fill(0);
    const subtotalEfectivo: { cantidad: number, monto: number } = { cantidad: 0, monto: 0 };
    const subtotalTransfer: { cantidad: number, monto: number } = { cantidad: 0, monto: 0 };
    const subtotalTarjeta: { cantidad: number, monto: number } = { cantidad: 0, monto: 0 };
    let subtotalTotal: number = 0;

    sales.forEach(sale => {
      const tableDisplay = sale.tableNameAtSale ? sale.tableNameAtSale : `Mesa ${sale.tableNumber || 'Sin Mesa'}`;
      const saleTime = new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const row: string[] = [`${tableDisplay}\n${saleTime}`];
      let otherProductsTotalForSale = 0;
      let otherProductsMoneyForSale = 0;

      // Cantidades y montos de productos para esta venta específica
      productsToShow.forEach((product, idx) => {
        const item = sale.items.find(i => i.id === product.id);
        const cantidad = item?.quantity || 0;
        row.push(formatQuantity(cantidad));
        subtotalCantidad[idx] += cantidad;
      });

      // Calcular total de 'Otros' para esta venta si el grupo 'Otros' existe
      if (othersGroup) {
        sale.items.forEach(item => {
          if (!productsToShow.some(p => p.id === item.id)) {
            otherProductsTotalForSale += item.quantity;
            // Buscar el precio del producto para sumar el monto
            const menuItem = menuItems.find(m => m.id === item.id);
            otherProductsMoneyForSale += (menuItem?.price || 0) * item.quantity;
          }
        });
        row.push(formatQuantity(otherProductsTotalForSale));
        subtotalCantidad[productsToShow.length] += otherProductsTotalForSale;
      }

      // Añadir totales por método de pago para esta venta
      const efectivo = sale.cashPart || (sale.paymentMethod === 'cash' ? sale.total : 0);
      const transferencia = sale.transferPart || (sale.paymentMethod === 'transfer' ? sale.total : 0);
      const tarjeta = sale.cardPart || (sale.paymentMethod === 'card' ? sale.total : 0);
      row.push(formatCurrency(efectivo, config.currencyCode));
      row.push(formatCurrency(transferencia, config.currencyCode));
      row.push(formatCurrency(tarjeta, config.currencyCode));
      row.push(formatCurrency(sale.total, config.currencyCode));

      subtotalEfectivo.cantidad += efectivo > 0 ? 1 : 0;
      subtotalEfectivo.monto += efectivo;
      subtotalTransfer.cantidad += transferencia > 0 ? 1 : 0;
      subtotalTransfer.monto += transferencia;
      subtotalTarjeta.cantidad += tarjeta > 0 ? 1 : 0;
      subtotalTarjeta.monto += tarjeta;
      subtotalTotal += sale.total;

      breakdownTableBody.push(row);
    });

    // Fila de subtotal de cantidades
    const subtotalCantidadRow: string[] = ['Subtotal Cantidad'];
    subtotalCantidad.forEach(cant => subtotalCantidadRow.push(formatQuantity(cant)));
    subtotalCantidadRow.push(
      formatQuantity(subtotalEfectivo.cantidad),
      formatQuantity(subtotalTransfer.cantidad),
      formatQuantity(subtotalTarjeta.cantidad),
      formatQuantity(subtotalCantidad.reduce((a, b) => a + b, 0))
    );
    breakdownTableBody.push(subtotalCantidadRow);

    // Fila de subtotal de montos
    const subtotalMontoRow: string[] = ['Subtotal Monto'];
    // Calcular montos por producto/otros
    productsToShow.forEach((product, idx) => {
      const monto = sales.reduce((sum, sale) => {
        const item = sale.items.find(i => i.id === product.id);
        const menuItem = menuItems.find(m => m.id === product.id);
        return sum + ((menuItem?.price || 0) * (item?.quantity || 0));
      }, 0);
      subtotalMontoRow.push(formatCurrency(monto, config.currencyCode));
    });
    if (othersGroup) {
      // Sumar montos de productos no incluidos en productsToShow
      const montoOtros = sales.reduce((sum, sale) => {
        return sum + sale.items.reduce((acc, item) => {
          if (!productsToShow.some(p => p.id === item.id)) {
            const menuItem = menuItems.find(m => m.id === item.id);
            return acc + ((menuItem?.price || 0) * item.quantity);
          }
          return acc;
        }, 0);
      }, 0);
      subtotalMontoRow.push(formatCurrency(montoOtros, config.currencyCode));
    }
    subtotalMontoRow.push(
      formatCurrency(subtotalEfectivo.monto, config.currencyCode),
      formatCurrency(subtotalTransfer.monto, config.currencyCode),
      formatCurrency(subtotalTarjeta.monto, config.currencyCode),
      formatCurrency(subtotalTotal, config.currencyCode)
    );
    breakdownTableBody.push(subtotalMontoRow);

    // Recalcular anchos de columna para la tabla de desglose
    const breakdownMesaWidth = usableWidth * 0.17; // 17% para la columna 'Mesa y Hora' (ajustado para que coincida con Resumen)
    const breakdownNumberOfProductColumns = productsToShow.length;
    const breakdownNumberOfPaymentColumns = 3; // Efec, Transf, Tarj
    let breakdownNumberOfDynamicColumns = breakdownNumberOfProductColumns + breakdownNumberOfPaymentColumns;
    if (othersGroup) {
      breakdownNumberOfDynamicColumns += 1; // Sumar 1 si hay columna 'Otros'
    }

    const breakdownRemainingWidth = usableWidth - breakdownMesaWidth - totalColWidth;
    const breakdownWidthPerDynamicColumn = breakdownNumberOfDynamicColumns > 0 ? breakdownRemainingWidth / breakdownNumberOfDynamicColumns : 0;

    const breakdownColumnStyles: { [key: string]: { cellWidth?: number, minCellWidth?: number, fillColor?: [number, number, number] } } = {
      '0': { cellWidth: breakdownMesaWidth }, // Columna 'Mesa' (índice 0)
    };

    let currentIndex = 1;
    // Columnas de productos
    for (let i = 0; i < breakdownNumberOfProductColumns; i++) {
      breakdownColumnStyles[currentIndex.toString()] = { cellWidth: breakdownWidthPerDynamicColumn };
      currentIndex++;
    }

    // Columna 'Otros' si existe
    if (othersGroup) {
      breakdownColumnStyles[currentIndex.toString()] = { cellWidth: breakdownWidthPerDynamicColumn };
      currentIndex++;
    }

    // Columnas de métodos de pago
    breakdownColumnStyles[currentIndex.toString()] = { cellWidth: breakdownWidthPerDynamicColumn }; // Efec
    currentIndex++;
    breakdownColumnStyles[currentIndex.toString()] = { cellWidth: breakdownWidthPerDynamicColumn }; // Transf
    currentIndex++;
    breakdownColumnStyles[currentIndex.toString()] = { cellWidth: breakdownWidthPerDynamicColumn }; // Tarj
    currentIndex++;

    // Columna Total
    breakdownColumnStyles[currentIndex.toString()] = { cellWidth: totalColWidth };

    autoTable(doc, {
      startY: startYDesglose + 5, // Un poco más abajo de la leyenda
      head: breakdownTableHead,
      body: breakdownTableBody,
      theme: 'grid',
      styles: { fontSize: dynamicFontSize, cellPadding: 1, overflow: 'linebreak', halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [255, 140, 0], fontSize: dynamicFontSize, halign: 'center', valign: 'middle', minCellHeight: 10 },
      footStyles: { fillColor: [255, 140, 0], fontSize: dynamicFontSize },
      columnStyles: breakdownColumnStyles,
      tableWidth: usableWidth // Forzar el ancho total de la tabla para que se ajuste a la página
    });

    // Guardar el PDF
    const fileName = `reporte_ventas_${date}.pdf`;
    console.log('Guardando PDF como:', fileName);
    doc.save(fileName);
    console.log('PDF generado exitosamente');
    showAlert('Reporte generado exitosamente. Revisa tu carpeta de descargas.');
  } catch (error) {
    console.error('Error generando PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    showAlert('Error al generar el reporte: ' + errorMessage);
  }
};

// Función auxiliar para obtener el nombre corto del método de pago
const getShortPaymentMethod = (method: string | undefined): string => {
  switch (method) {
    case 'cash': return 'Efec';
    case 'transfer': return 'Transf';
    case 'card': return 'Tarj';
    case 'mixed': return 'Mixto';
    default: return 'NoEsp';
  }
};

// Función para preparar los datos del resumen para Excel
const prepareResumenData = (config: BusinessConfig, sales: DailySale[], menuItems: MenuItem[], date: string) => {
  const first6Products = menuItems.slice(0, 6);
  const otherProductsHeader = 'Otros';
  const productTotalsResumen: { [key: string]: number } = {};
  const productMoneyTotalsDesglose: { [key: string]: number } = {};

  // Calcular totales del resumen
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      productTotalsResumen[item.id] = (productTotalsResumen[item.id] || 0) + item.quantity;
      const menuItem = menuItems.find(m => m.id === item.id);
      const price = menuItem?.price || 0;
      productMoneyTotalsDesglose[item.id] = (productMoneyTotalsDesglose[item.id] || 0) + (item.quantity * price);
    });
  });

  // Calcular totales de Efectivo, Transferencia y Tarjeta
  let totalEfectivoResumen = 0;
  let totalTransferResumen = 0;
  let totalTarjetaResumen = 0;
  let cantidadEfectivoResumen = 0;
  let cantidadTransferenciaResumen = 0;
  let cantidadTarjetaResumen = 0;

  const salesBySessionForSummary = sales.reduce((acc: { [key: string]: DailySale[] }, sale: DailySale) => {
    const sessionId = `${sale.tableNumber}-${new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    acc[sessionId] = acc[sessionId] || [];
    acc[sessionId].push(sale);
    return acc;
  }, {});

  for (const sessionId in salesBySessionForSummary) {
    const salesForSession = salesBySessionForSummary[sessionId];
    if (salesForSession.length > 0) {
      let efectivoTotalSesion = 0;
      let transferenciaTotalSesion = 0;
      let tarjetaTotalSesion = 0;
      
      salesForSession.forEach((sale) => {
        // Usar los campos específicos de pago si están disponibles, de lo contrario usar la lógica basada en el método
        if (sale.cashPart !== undefined) {
          efectivoTotalSesion += sale.cashPart;
        } else if (sale.paymentMethod === 'cash') {
          efectivoTotalSesion += sale.total;
        }
        
        if (sale.transferPart !== undefined) {
          transferenciaTotalSesion += sale.transferPart;
        } else if (sale.paymentMethod === 'transfer') {
          transferenciaTotalSesion += sale.total;
        }
        
        if (sale.cardPart !== undefined) {
          tarjetaTotalSesion += sale.cardPart;
        } else if (sale.paymentMethod === 'card') {
          tarjetaTotalSesion += sale.total;
        }
      });
      
      // Actualizar totales y contadores
      totalEfectivoResumen += efectivoTotalSesion;
      totalTransferResumen += transferenciaTotalSesion;
      totalTarjetaResumen += tarjetaTotalSesion;
      
      // Contar sesiones por método de pago (para el conteo de unidades)
      const paymentMethod = salesForSession[0]?.paymentMethod || 'No especificado';
      if (paymentMethod === 'transfer') {
        cantidadTransferenciaResumen++;
      } else if (paymentMethod === 'card') {
        cantidadTarjetaResumen++;
      } else {
        // Contabilizar como efectivo si es cash o no definido
        cantidadEfectivoResumen++;
      }
    }
  }

  const total = sales.reduce((sum, sale) => sum + sale.total, 0);

  return {
    data: [
      // Encabezado del negocio
      [config.name || ''],
      [config.reportTitle || 'Reporte Diario de Ventas', new Date(date).toLocaleDateString('es-MX')],
      [], // Línea en blanco
      // Encabezados de columnas
      ['Resumen', ...first6Products.map(p => p.name.substring(0, 12)), otherProductsHeader, '', 'Efec', 'Transf', 'Tarjeta', '', 'Total'],
      // Fila de unidades
      ['Unidades', 
        ...first6Products.map(p => String(productTotalsResumen[p.id] || 0)),
        String(Object.entries(productTotalsResumen)
          .filter(([id]) => !first6Products.some(p => p.id === id))
          .reduce((sum, [_, qty]) => sum + qty, 0)),
        '',
        String(cantidadEfectivoResumen),
        String(cantidadTransferenciaResumen),
        String(cantidadTarjetaResumen),
        '',
        String(cantidadEfectivoResumen + cantidadTransferenciaResumen + cantidadTarjetaResumen)
      ],
      // Fila de montos
      ['Monto Unidades',
        ...first6Products.map(p => `$${Number(productMoneyTotalsDesglose[p.id] || 0).toFixed(2)}`),
        `$${Number(Object.entries(productMoneyTotalsDesglose)
          .filter(([id]) => !first6Products.some(p => p.id === id))
          .reduce((sum, [_, amount]) => sum + amount, 0)).toFixed(2)}`,
        '',
        `$${Number(totalEfectivoResumen).toFixed(2)}`,
        `$${Number(totalTransferResumen).toFixed(2)}`,
        `$${Number(totalTarjetaResumen).toFixed(2)}`,
        '',
        `$${Number(totalEfectivoResumen + totalTransferResumen + totalTarjetaResumen).toFixed(2)}`
      ]
    ],
    first6Products,
    productTotalsResumen,
    productMoneyTotalsDesglose
  };
};

// Función para preparar los datos del desglose para Excel
const prepareDesgloseData = (config: BusinessConfig, sales: DailySale[], menuItems: MenuItem[], date: string, first6Products: MenuItem[], productMoneyTotalsDesglose: { [key: string]: number }) => {
  const otherProductsHeader = 'Otros';
  const salesBySession = sales.reduce((acc: { [key: string]: DailySale[] }, sale: DailySale) => {
    const sessionId = `${sale.tableNumber}-${new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    acc[sessionId] = acc[sessionId] || [];
    acc[sessionId].push(sale);
    return acc;
  }, {});

  const desgloseData = [
    // Encabezado del negocio
    [config.name || ''],
    [config.reportTitle || 'Reporte Diario de Ventas', new Date(date).toLocaleDateString('es-MX')],
    [], // Línea en blanco
    ['Ventas por Mesa:'],
    [], // Línea en blanco
    // Encabezados de columnas
    ['Mesa', ...first6Products.map(p => p.name.substring(0, 12)), otherProductsHeader, '', 'Método', '', 'Total']
  ];

  // Agregar filas de ventas por mesa
  const productTotalsDesgloseCantidad: { [key: string]: number } = {};
  let totalEfectivoDesglose = 0;
  let totalTransferDesglose = 0;
  let totalTarjetaDesglose = 0;

  for (const sessionId in salesBySession) {
    const salesForSession = salesBySession[sessionId];
    const [tableNumberStr, hora] = sessionId.split('-');
    const relevantSale = sales.find(sale => 
      String(sale.tableNumber) === tableNumberStr && 
      new Date(sale.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) === hora
    );
    const mesaNameAtSale = relevantSale?.tableNameAtSale ?? `Mesa ${tableNumberStr}`;
    const paymentMethod = salesForSession[0]?.paymentMethod || 'No especificado';
    let totalForSession = 0;
    let efectivoTotalSesion = 0;
    let transferenciaTotalSesion = 0;
    let tarjetaTotalSesion = 0;

    const productCounts: { [key: string]: number } = {};
    salesForSession.forEach((sale) => {
      // Usar los campos específicos de pago si están disponibles, de lo contrario usar la lógica basada en el método
      if (sale.cashPart !== undefined) {
        efectivoTotalSesion += sale.cashPart;
      } else if (sale.paymentMethod === 'cash') {
        efectivoTotalSesion += sale.total;
      }
      
      if (sale.transferPart !== undefined) {
        transferenciaTotalSesion += sale.transferPart;
      } else if (sale.paymentMethod === 'transfer') {
        transferenciaTotalSesion += sale.total;
      }
      
      if (sale.cardPart !== undefined) {
        tarjetaTotalSesion += sale.cardPart;
      } else if (sale.paymentMethod === 'card') {
        tarjetaTotalSesion += sale.total;
      }
      
      totalForSession += sale.total;
      sale.items.forEach((item) => {
        productCounts[item.id] = (productCounts[item.id] || 0) + item.quantity;
        productTotalsDesgloseCantidad[item.id] = (productTotalsDesgloseCantidad[item.id] || 0) + item.quantity;
      });
    });

    // Actualizar totales generales usando los valores calculados específicos
    totalEfectivoDesglose += efectivoTotalSesion;
    totalTransferDesglose += transferenciaTotalSesion;
    totalTarjetaDesglose += tarjetaTotalSesion;

    desgloseData.push([
      `${mesaNameAtSale}\n${hora}`,
      ...first6Products.map(p => String(productCounts[p.id] || 0)),
      String(Object.entries(productCounts)
        .filter(([id]) => !first6Products.some(p => p.id === id))
        .reduce((sum, [_, qty]) => sum + qty, 0)),
      '',
      getShortPaymentMethod(paymentMethod),
      '',
      `$${Number(totalForSession).toFixed(2)}`
    ]);
  }

  const total = sales.reduce((sum, sale) => sum + sale.total, 0);

  // Agregar fila de totales por cantidad
  desgloseData.push([
    'Unidades',
    ...first6Products.map(p => String(productTotalsDesgloseCantidad[p.id] || 0)),
    String(Object.entries(productTotalsDesgloseCantidad)
      .filter(([id]) => !first6Products.some(p => p.id === id))
      .reduce((sum, [_, qty]) => sum + qty, 0)),
    '',
    '',
    '',
    `$${Number(total).toFixed(2)}`
  ]);

  // Agregar fila de totales monetarios
  desgloseData.push([
    'Monto Unidades',
    ...first6Products.map(p => `$${Number(productMoneyTotalsDesglose[p.id] || 0).toFixed(2)}`),
    `$${Number(Object.entries(productMoneyTotalsDesglose)
      .filter(([id]) => !first6Products.some(p => p.id === id))
      .reduce((sum, [_, amount]) => sum + amount, 0)).toFixed(2)}`,
    '',
    `$${Number(totalEfectivoDesglose).toFixed(2)}`,
    `$${Number(totalTransferDesglose).toFixed(2)}`,
    `$${Number(totalTarjetaDesglose).toFixed(2)}`,
    '',
    `$${Number(total).toFixed(2)}`
  ]);

  return desgloseData;
};

// Función para aplicar estilos a las hojas de Excel
const applyExcelStyles = (ws: XLSX.WorkSheet, data: any[][]) => {
  // Estilo para el encabezado del negocio
  ws['A1'].s = { font: { bold: true, size: 14 }, alignment: { horizontal: "center" } };
  ws['A2'].s = { font: { bold: true, size: 12 }, alignment: { horizontal: "center" } };

  // Estilo para los encabezados de columnas
  const headerStyle = {
    font: { bold: true, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "E6E6E6" } },
    alignment: { horizontal: "center", vertical: "center" }
  };

  for (let i = 0; i < data[3].length; i++) {
    const cell = XLSX.utils.encode_cell({ r: 3, c: i });
    ws[cell].s = headerStyle;
  }

  // Estilo para las filas de totales
  const totalStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: "F0F0F0" } },
    alignment: { horizontal: "right", vertical: "center" }
  };

  const lastRow = data.length - 1;
  for (let i = 0; i < data[lastRow].length; i++) {
    const cell = XLSX.utils.encode_cell({ r: lastRow, c: i });
    ws[cell].s = totalStyle;
  }

  // Ajustar anchos de columna
  const wscols = [
    { wch: 15 }, // Mesa/Resumen
    ...Array(6).fill({ wch: 12 }), // Productos
    { wch: 12 }, // Otros
    { wch: 2 }, // Espacio
    { wch: 10 }, // Efectivo
    { wch: 10 }, // Transferencia
    { wch: 10 }, // Tarjeta
    { wch: 2 }, // Espacio
    { wch: 15 }  // Total
  ];
  ws['!cols'] = wscols;
};

// Función principal para exportar a Excel
export function exportNewDailyReportToExcel(config: BusinessConfig) {
  const { sales, total, products, date } = getDailySalesReport();
  const menuItems: MenuItem[] = getMenu();
  const wb = XLSX.utils.book_new();

  // Preparar datos para el resumen
  const { data: resumenData, first6Products, productMoneyTotalsDesglose } = prepareResumenData(config, sales, menuItems, date);

  // Preparar datos para el desglose
  const desgloseData = prepareDesgloseData(config, sales, menuItems, date, first6Products, productMoneyTotalsDesglose);

  // Crear hojas de Excel
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  const wsDesglose = XLSX.utils.aoa_to_sheet(desgloseData);

  // Aplicar estilos
  applyExcelStyles(wsResumen, resumenData);
  applyExcelStyles(wsDesglose, desgloseData);

  // Agregar hojas al libro
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsDesglose, "Ventas por Mesa");

  // Guardar el archivo
  const baseFileName = config.excelFileName || 'Reporte_Diario_Ventas';
  XLSX.writeFile(wb, `${baseFileName}-${date}.xlsx`);
}