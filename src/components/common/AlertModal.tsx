import React from 'react';

interface AlertModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ open, message, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full text-center">
        <h3 className="text-lg font-bold text-orange-600 mb-2">CalcTac alerta</h3>
        <p className="text-gray-800 mb-4">{message}</p>
        <button
          className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-semibold"
          onClick={onClose}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
};

export default AlertModal; 