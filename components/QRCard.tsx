import React, { useEffect, useState } from 'react';
import { generateQRCodeDataURL } from '../utils/qrHelpers';
import { THEMES } from '../constants';
import { ThemeOption } from '../types';

interface QRCardProps {
  rawValue: string;
  amount: string;
  themeId: string;
  label?: string;
  customBackground?: string; // New prop
  id?: string;
}

export const QRCard: React.FC<QRCardProps> = ({ rawValue, amount, themeId, label, customBackground, id }) => {
  const [qrSrc, setQrSrc] = useState<string>('');
  
  const theme: ThemeOption = THEMES.find(t => t.id === themeId) || THEMES[0];

  useEffect(() => {
    let active = true;
    const generate = async () => {
      const url = await generateQRCodeDataURL(rawValue);
      if (active) setQrSrc(url);
    };
    generate();
    return () => { active = false; };
  }, [rawValue]);

  // Priority: Custom Background > Theme Value
  const backgroundStyle: React.CSSProperties = customBackground 
    ? { background: `url(${customBackground}) no-repeat center center / cover` }
    : {
      background: theme.type === 'image' 
        ? `url(${theme.value}) no-repeat center center / cover` 
        : theme.value,
    };

  return (
    <div 
      id={id}
      className="relative w-full aspect-[4/5] rounded-[36px] overflow-hidden shadow-premium ring-1 ring-black/5 flex flex-col items-center justify-between p-10 transition-all duration-300 bg-white"
      style={backgroundStyle}
    >
      {/* Overlay - Always white/glass for consistency and readability */}
      <div 
        className="absolute inset-0 bg-white/90 backdrop-blur-md transition-opacity duration-300" 
        style={{ opacity: customBackground ? 0.85 : theme.overlayOpacity }}
      />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center w-full h-full justify-between">
        
        {/* Header/Label */}
        <div className="flex flex-col items-center justify-center w-full text-center mt-2">
          <span className="font-display font-bold tracking-widest text-xs uppercase text-zinc-900 opacity-60 truncate max-w-full px-4 letter-spacing-2">
            {label || 'PAYMENT QR'}
          </span>
        </div>

        {/* QR Code Container */}
        <div className="relative bg-white p-4 rounded-[28px] shadow-sm ring-1 ring-zinc-100 w-full aspect-square flex items-center justify-center">
          {qrSrc && (
            <img 
              src={qrSrc} 
              alt="QR Code" 
              className="w-full h-full object-contain mix-blend-multiply opacity-95" 
            />
          )}
          {/* Subtle inner corner decorations */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-zinc-900/10 rounded-tl-lg" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-zinc-900/10 rounded-tr-lg" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-zinc-900/10 rounded-bl-lg" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-zinc-900/10 rounded-br-lg" />
        </div>

        {/* Amount Display */}
        <div className="w-full text-center mb-2 h-16 flex items-center justify-center overflow-hidden px-2">
          {amount ? (
            <div className="flex flex-col items-center animate-slide-up w-full">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-0.5">Total Amount</span>
              <div className="text-[40px] leading-none font-display font-bold text-zinc-900 tracking-tighter truncate w-full">
                <span className="text-2xl align-top opacity-40 font-sans mr-0.5">₹</span>{amount}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center opacity-30 text-zinc-900">
              <span className="text-xs font-medium tracking-wide">Scan & Pay</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative glass reflection hint */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-50 pointer-events-none" />
    </div>
  );
};