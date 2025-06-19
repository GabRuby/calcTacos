import React, { useState } from 'react';
import { useMenu } from '../../contexts/MenuContext';
import { formatCurrency } from '../../utils/currencyFormatter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDailySalesReport } from '../../utils/dailySales';
import { QrCode, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface LoadTableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoadTableModal: React.FC<LoadTableModalProps> = ({ isOpen, onClose }) => {
  const { menuItems } = useMenu();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  // Obtener ventas cerradas (mesas guardadas)
  const sales = getDailySalesReport().sales;

  // Agrupar por mesa y hora (cada venta es una mesa cerrada)
  const selectedSale = sales.find(sale => sale.id === selectedSaleId);
  const order = selectedSale?.items || [];

  // Calcular el consumo y total
  const orderDetails = order.map(item => {
    const product = menuItems.find(m => m.id === item.id);
    return {
      ...item,
      name: product?.name || 'Producto',
      price: product?.price || 0,
      subtotal: (product?.price || 0) * item.quantity
    };
  });
  const total = orderDetails.reduce((sum, item) => sum + item.subtotal, 0);

  // Método de pago
  const paymentMethod = selectedSale?.paymentMethod || 'NoEsp';
  const paymentMethodText = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    mixed: 'Mixto',
    NoEsp: 'No especificado'
  }[paymentMethod] || paymentMethod;

  // Texto para QR y copiar
  const qrText = selectedSale ?
    `Detalle de Consumo\n${orderDetails.map(item => `${item.name} x ${item.quantity} = ${formatCurrency(item.subtotal)}`).join('\n')}\nTotal: ${formatCurrency(total)}\nMétodo de pago: ${paymentMethodText}`
    : '';

  const handleGeneratePDF = () => {
    if (!selectedSale) return;
    const doc = new jsPDF();
    let y = 15;
    // Encabezado general
    doc.setFontSize(16);
    doc.text('Detalle de Consumo', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.text(`Hora: ${selectedSale.timestamp ? new Date(selectedSale.timestamp).toLocaleTimeString() : ''}`, 15, y);
    doc.text(`Método de pago: ${paymentMethodText}`, 120, y);
    y += 10;
    // Tabla elegante
    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal']],
      body: orderDetails.map(item => [item.name, item.quantity, formatCurrency(item.price), formatCurrency(item.subtotal)]),
      theme: 'grid',
      headStyles: { fillColor: [255, 140, 0], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { halign: 'center' },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });
    // Total
    const finalY = (doc as any).lastAutoTable.finalY || y + 30;
    doc.setFontSize(13);
    doc.text('Total:', 140, finalY + 10);
    doc.text(formatCurrency(total), 195, finalY + 10, { align: 'right' });
    // Guardar PDF
    doc.save(`nota-mesa-${selectedSale.tableNumber}.pdf`);
  };

  const handleCopy = async () => {
    if (!qrText) return;
    try {
      await navigator.clipboard.writeText(qrText.replace(/\\n/g, '\n'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1000);
    } catch {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Cargar Mesa</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Mesas cerradas</h3>
          <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
            {sales.map(sale => (
              <li key={sale.id} className={`py-2 px-2 cursor-pointer rounded ${selectedSaleId === sale.id ? 'bg-orange-100' : ''}`}
                  onClick={() => setSelectedSaleId(sale.id)}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{sale.tableNameAtSale ?? `Mesa ${sale.tableNumber}`}</span>
                  <span className="text-sm text-gray-500">{sale.timestamp ? new Date(sale.timestamp).toLocaleTimeString() : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {/* Detalle de la venta seleccionada */}
        {selectedSaleId && selectedSale && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-center mb-2 gap-2">
              <h4 className="font-semibold">Consumo</h4>
              <div className="flex gap-2">
                <button onClick={() => setShowQR(true)} title="Ver QR" className="text-orange-600 hover:text-orange-800">
                  <QrCode size={22} />
                </button>
                <button onClick={handleCopy} title="Copiar detalle" className="text-gray-600 hover:text-gray-900">
                  <Copy size={20} />
                </button>
              </div>
            </div>
            <ul className="divide-y divide-gray-200 mb-2">
              {orderDetails.map(item => (
                <li key={item.id} className="flex justify-between items-center py-1 text-sm">
                  <span>{item.name} x {item.quantity}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-bold text-base mt-2">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">Método de pago: <span className="font-semibold">{paymentMethodText}</span></div>
            <button
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700"
              onClick={handleGeneratePDF}
            >
              Generar Nota PDF
            </button>
            {/* Toast sutil */}
            <div
              className={`fixed left-1/2 bottom-10 transform -translate-x-1/2 transition-opacity duration-300 pointer-events-none ${showToast ? 'opacity-100' : 'opacity-0'}`}
              style={{ zIndex: 9999 }}
            >
              <div className="bg-black bg-opacity-80 text-white rounded px-4 py-2 text-sm shadow-lg">
                Detalle copiado
              </div>
            </div>
          </div>
        )}
        {/* Modal QR */}
        {showQR && selectedSale && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 text-orange-600">Detalle de Consumo</h3>
              <QRCodeSVG value={qrText} size={200} level="H" includeMargin={true} />
              <div className="mt-4 text-xs whitespace-pre-line text-center text-gray-700">{qrText}</div>
              <button
                className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-semibold"
                onClick={() => setShowQR(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadTableModal; 