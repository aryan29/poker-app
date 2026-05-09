'use client';

interface CardProps {
  card?: string; // e.g. "As", "Kh", "Tc"
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const RANK_DISPLAY: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

const SIZE_CLASSES = {
  sm: { card: 'w-8 h-12', rank: 'text-sm', suit: 'text-lg' },
  md: { card: 'w-12 h-[4.2rem]', rank: 'text-base', suit: 'text-2xl' },
  lg: { card: 'w-16 h-24', rank: 'text-xl', suit: 'text-4xl' },
};

function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = SIZE_CLASSES[size];
  return (
    <div
      className={`${s.card} rounded-lg shadow-xl border border-blue-900 relative overflow-hidden flex-shrink-0`}
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      {/* Diamond pattern */}
      <div
        className="absolute inset-1 rounded"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            rgba(255,255,255,0.05) 0px,
            rgba(255,255,255,0.05) 2px,
            transparent 2px,
            transparent 8px
          )`,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-blue-400/40 text-xl font-bold select-none">★</span>
      </div>
    </div>
  );
}

function CardFace({
  card,
  size = 'md',
}: {
  card: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const rawRank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const rank = RANK_DISPLAY[rawRank] ?? rawRank;
  const symbol = SUIT_SYMBOLS[suit] ?? suit;
  const isRed = suit === 'h' || suit === 'd';
  const s = SIZE_CLASSES[size];

  return (
    <div
      className={`${s.card} rounded-lg relative overflow-hidden flex-shrink-0 select-none`}
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.12)',
      }}
    >
      {/* Top-left rank + suit */}
      <div
        className={`absolute top-0.5 left-1 flex flex-col items-center leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}
      >
        <span className={`${s.rank} font-black leading-tight`}>{rank}</span>
        <span className="text-xs leading-tight">{symbol}</span>
      </div>

      {/* Center suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`${s.suit} ${isRed ? 'text-red-500' : 'text-gray-800'} opacity-70`}
          style={{ textShadow: isRed ? '0 1px 2px rgba(220,38,38,0.3)' : 'none' }}
        >
          {symbol}
        </span>
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div
        className={`absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}
      >
        <span className={`${s.rank} font-black leading-tight`}>{rank}</span>
        <span className="text-xs leading-tight">{symbol}</span>
      </div>
    </div>
  );
}

export function Card({ card, faceDown = false, size = 'md', className = '' }: CardProps) {
  if (faceDown || !card) {
    return (
      <div className={className}>
        <CardBack size={size} />
      </div>
    );
  }
  return (
    <div className={className}>
      <CardFace card={card} size={size} />
    </div>
  );
}
