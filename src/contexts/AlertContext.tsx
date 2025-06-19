import React, { createContext, useContext, useState, ReactNode } from 'react';
import AlertModal from '../components/common/AlertModal';

interface AlertContextType {
  showAlert: (message: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert debe usarse dentro de un AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const showAlert = (msg: string) => {
    setMessage(msg);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setMessage('');
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AlertModal open={open} message={message} onClose={handleClose} />
    </AlertContext.Provider>
  );
}; 