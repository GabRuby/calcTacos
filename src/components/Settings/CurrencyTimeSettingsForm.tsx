// src/components/CurrencyTimeSettingsForm.tsx
import React, { useState, useEffect } from 'react';
import { BusinessConfig, WorkingHours, CURRENCIES } from '../../types'; // Ajusta la ruta si es necesario

interface CurrencyTimeSettingsFormProps {
  config: BusinessConfig;
  onConfigChange: (config: BusinessConfig) => void;
}

const dayNames = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

// Función para obtener información del dispositivo
const getDeviceTimeInfo = () => {
  try {
    const now = new Date();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const deviceTime = now.toLocaleString();
    const deviceOffset = now.getTimezoneOffset();
    const deviceOffsetHours = Math.abs(deviceOffset / 60);
    const deviceOffsetMinutes = Math.abs(deviceOffset % 60);
    const offsetString = `${deviceOffset <= 0 ? '+' : '-'}${deviceOffsetHours.toString().padStart(2, '0')}:${deviceOffsetMinutes.toString().padStart(2, '0')}`;
    
    return {
      timeZone,
      deviceTime,
      offsetString,
      timestamp: now.getTime(),
      isValid: true
    };
  } catch (error) {
    return {
      timeZone: 'No detectada',
      deviceTime: 'No disponible',
      offsetString: 'N/A',
      timestamp: Date.now(),
      isValid: false
    };
  }
};

// Función para validar zona horaria
const isValidTimeZone = (timeZone: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
};

export function CurrencyTimeSettingsForm({ config, onConfigChange }: CurrencyTimeSettingsFormProps) {
  const [deviceInfo, setDeviceInfo] = useState(getDeviceTimeInfo());
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Actualizar información del dispositivo cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setDeviceInfo(getDeviceTimeInfo());
      setLastUpdate(new Date());
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, []);

  const handleWorkingHoursChange = (day: string, field: keyof WorkingHours, value: string | boolean) => {
    const updatedWorkingHours = config.workingHours.map(wh => {
      if (wh.day === day) {
        return { ...wh, [field]: value };
      }
      return wh;
    });
    onConfigChange({ ...config, workingHours: updatedWorkingHours });
  };

  const handleUseDeviceTime = () => {
    if (deviceInfo.isValid && isValidTimeZone(deviceInfo.timeZone)) {
      onConfigChange({ ...config, timeZone: deviceInfo.timeZone });
      setShowManualConfig(false);
    }
  };

  const handleManualTimeZoneChange = (timeZone: string) => {
    onConfigChange({ ...config, timeZone });
  };

  const getTimeSinceUpdate = () => {
    const diff = Date.now() - lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes === 0) return 'Justo ahora';
    if (minutes === 1) return 'Hace 1 minuto';
    return `Hace ${minutes} minutos`;
  };

  return (
    <div className="space-y-6">
      {/* Configuración de Moneda */}
      <div>
        <label htmlFor="currencyCode" className="block text-sm font-medium text-gray-700 mb-1">
          Moneda
        </label>
        <select
          id="currencyCode"
          value={config.currencyCode}
          onChange={(e) => onConfigChange({ ...config, currencyCode: e.target.value })}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.name} ({currency.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Configuración de Zona Horaria del Dispositivo */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Información del Dispositivo</h4>
        
        <div className="space-y-3">
          {/* Zona Horaria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zona Horaria del Dispositivo
            </label>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-2 border rounded-md flex-1 ${
                deviceInfo.isValid && isValidTimeZone(deviceInfo.timeZone) 
                  ? 'bg-green-50 border-green-300 text-green-800' 
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}>
                {deviceInfo.timeZone}
              </span>
              {deviceInfo.isValid && isValidTimeZone(deviceInfo.timeZone) ? (
                <span className="text-green-600">✅</span>
              ) : (
                <span className="text-red-600">⚠️</span>
              )}
            </div>
          </div>

          {/* Hora del Dispositivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora del Dispositivo
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 border rounded-md bg-blue-50 border-blue-300 text-blue-800 flex-1">
                {deviceInfo.deviceTime}
              </span>
              <span className="text-blue-600">🕐</span>
            </div>
          </div>

          {/* Offset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Offset UTC
            </label>
            <span className="px-3 py-2 border rounded-md bg-gray-100 text-gray-800">
              {deviceInfo.offsetString}
            </span>
          </div>

          {/* Última actualización */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Última actualización
            </label>
            <span className="px-3 py-2 border rounded-md bg-gray-100 text-gray-800">
              {getTimeSinceUpdate()}
            </span>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUseDeviceTime}
              disabled={!deviceInfo.isValid || !isValidTimeZone(deviceInfo.timeZone)}
              className={`px-4 py-2 rounded-md font-medium ${
                deviceInfo.isValid && isValidTimeZone(deviceInfo.timeZone)
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Usar configuración del dispositivo
            </button>
            <button
              onClick={() => setShowManualConfig(!showManualConfig)}
              className="px-4 py-2 rounded-md font-medium bg-orange-500 text-white hover:bg-orange-600"
            >
              {showManualConfig ? 'Ocultar configuración manual' : 'Configurar manualmente'}
            </button>
          </div>
        </div>
      </div>

      {/* Configuración Manual de Zona Horaria */}
      {showManualConfig && (
        <div className="border rounded-lg p-4 bg-orange-50">
          <h4 className="text-md font-semibold text-gray-800 mb-3">Configuración Manual de Zona Horaria</h4>
          
          <div>
            <label htmlFor="manualTimeZone" className="block text-sm font-medium text-gray-700 mb-1">
              Seleccionar Zona Horaria
            </label>
            <select
              id="manualTimeZone"
              value={config.timeZone}
              onChange={(e) => handleManualTimeZoneChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value="">Seleccionar zona horaria...</option>
              <optgroup label="México">
                <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                <option value="America/Tijuana">Tijuana (UTC-8)</option>
                <option value="America/Monterrey">Monterrey (UTC-6)</option>
                <option value="America/Cancun">Cancún (UTC-5)</option>
              </optgroup>
              <optgroup label="Estados Unidos">
                <option value="America/New_York">Nueva York (UTC-5)</option>
                <option value="America/Chicago">Chicago (UTC-6)</option>
                <option value="America/Denver">Denver (UTC-7)</option>
                <option value="America/Los_Angeles">Los Ángeles (UTC-8)</option>
              </optgroup>
              <optgroup label="España">
                <option value="Europe/Madrid">Madrid (UTC+1)</option>
                <option value="Europe/Barcelona">Barcelona (UTC+1)</option>
              </optgroup>
              <optgroup label="Argentina">
                <option value="America/Argentina/Buenos_Aires">Buenos Aires (UTC-3)</option>
              </optgroup>
              <optgroup label="Colombia">
                <option value="America/Bogota">Bogotá (UTC-5)</option>
              </optgroup>
            </select>
          </div>
        </div>
      )}

      {/* Zona Horaria Actual */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Zona Horaria Actual
        </label>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-2 border rounded-md flex-1 ${
            config.timeZone && isValidTimeZone(config.timeZone)
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {config.timeZone || 'No configurada'}
          </span>
          {config.timeZone && isValidTimeZone(config.timeZone) ? (
            <span className="text-green-600">✅</span>
          ) : (
            <span className="text-red-600">⚠️</span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Esta es la zona horaria que se usará para gestionar los horarios de operación.
        </p>
      </div>

      {/* Configuración de Horario de Trabajo */}
      <div className="mt-8">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Horario de Jornada Laboral por Día</h4>
        <div className="space-y-4">
          {config.workingHours.map((wh) => (
            <div key={wh.day} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center border rounded-md bg-gray-50">
              <span className="font-medium text-gray-800 col-span-1 md:col-span-1">{dayNames[wh.day]}</span>

              <div className="flex items-center gap-2 col-span-1 md:col-span-1">
                <input
                  type="checkbox"
                  id={`isClosed-${wh.day}`}
                  checked={wh.isClosed}
                  onChange={(e) => handleWorkingHoursChange(wh.day, 'isClosed', e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-300"
                />
                <label htmlFor={`isClosed-${wh.day}`} className="text-sm text-gray-700">Cerrado</label>
              </div>

              {!wh.isClosed && (
                <>
                  <div className="col-span-1 md:col-span-1">
                    <label htmlFor={`openTime-${wh.day}`} className="block text-xs font-medium text-gray-600 mb-1">Apertura</label>
                    <input
                      type="time"
                      id={`openTime-${wh.day}`}
                      value={wh.openTime}
                      onChange={(e) => handleWorkingHoursChange(wh.day, 'openTime', e.target.value)}
                      className="w-full px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label htmlFor={`closeTime-${wh.day}`} className="block text-xs font-medium text-gray-600 mb-1">Cierre</label>
                    <input
                      type="time"
                      id={`closeTime-${wh.day}`}
                      value={wh.closeTime}
                      onChange={(e) => handleWorkingHoursChange(wh.day, 'closeTime', e.target.value)}
                      className="w-full px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}