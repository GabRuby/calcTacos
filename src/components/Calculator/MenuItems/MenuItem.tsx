import React from 'react';
import { MenuItem as MenuItemType } from '../../../types';
import { QuantityControl } from './QuantityControl';
import { PesosInput } from './PesosInput';
import { formatCurrency } from '../../../utils/currencyFormatter';

interface MenuItemProps {
  item: MenuItemType;
  quantity: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  fontSizeLevel?: number;
  hidePrice?: boolean;
}

export function MenuItem({ item, quantity, onUpdateQuantity, isSelected, onSelect, fontSizeLevel = 0, hidePrice = false }: MenuItemProps) {
  const handleClick = () => {
    onSelect(item.id);
  };

  // Definir clases de tamaño de letra según el nivel
  let nameFontClass = 'text-sm sm:text-base';
  if (fontSizeLevel === 1) nameFontClass = 'text-lg sm:text-xl';
  if (fontSizeLevel === 2) nameFontClass = 'text-2xl sm:text-3xl';

  return (
    <div 
      className={`flex items-center justify-between bg-orange-50 rounded-lg transition-all duration-200 ease-in-out cursor-pointer
        ${isSelected ? 'py-4 border-2 border-orange-500' : 'py-2 hover:bg-orange-100'}
      `}
      onClick={handleClick}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
    >
      <div className="flex items-center justify-between flex-1 mr-2 px-2">
        <h3 className={`font-medium text-gray-800 ${nameFontClass}`}> {item.name}</h3>
        {!isSelected && !hidePrice && (
        <span className="text-orange-600 font-medium text-sm sm:text-base">
            {item.isPesos ? `${formatCurrency(item.price)} por ${item.unit || 'unidad'}` : `${formatCurrency(item.price)}`}
        </span>
        )}
      </div>
      
      {item.isPesos ? (
        <PesosInput
          item={item}
          value={quantity}
          onChange={(value) => onUpdateQuantity(item.id, value)}
        />
      ) : (
        <QuantityControl
          quantity={quantity}
          onUpdate={(value) => onUpdateQuantity(item.id, value)}
        />
      )}
    </div>
  );
}