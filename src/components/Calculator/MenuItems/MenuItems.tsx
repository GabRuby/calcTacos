import React, { useState } from 'react';
import { MenuItem } from './MenuItem';
import { TacoOrder } from '../../../types';
import { useMenu } from '../../../contexts/MenuContext';
import { Plus, Minus } from 'lucide-react';

interface MenuItemsProps {
  order: TacoOrder[];
  onUpdateQuantity: (id: string, quantity: number) => void;
}

export function MenuItems({ order, onUpdateQuantity }: MenuItemsProps) {
  const { menuItems } = useMenu();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [fontSizeLevel, setFontSizeLevel] = useState(0); // 0: normal, 1: grande, 2: extra grande

  const getQuantity = (id: string) => {
    return order.find(item => item.id === id)?.quantity || 0;
  };

  const handleMenuItemClick = (id: string) => {
    setSelectedItemId(prevId => (prevId === id ? null : id));
  };

  const increaseFont = () => setFontSizeLevel((prev) => Math.min(2, prev + 1));
  const decreaseFont = () => setFontSizeLevel((prev) => Math.max(0, prev - 1));
  const hidePrice = fontSizeLevel === 2;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Menú</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={decreaseFont}
            className="p-1 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 disabled:opacity-50"
            disabled={fontSizeLevel === 0}
            title="Reducir tamaño de letra"
            type="button"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={increaseFont}
            className="p-1 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 disabled:opacity-50"
            disabled={fontSizeLevel === 2}
            title="Aumentar tamaño de letra"
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <div className="grid gap-1.5">
        {menuItems.map((item) => (
          <MenuItem
            key={item.id}
            item={item}
            quantity={getQuantity(item.id)}
            onUpdateQuantity={onUpdateQuantity}
            isSelected={selectedItemId === item.id}
            onSelect={handleMenuItemClick}
            fontSizeLevel={fontSizeLevel}
            hidePrice={hidePrice}
          />
        ))}
      </div>
    </div>
  );
}