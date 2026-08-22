import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { FaceRegion } from '../utils/detectFaces';

type Props = {
  /** Natural pixel size of the image the rectangles were measured against. */
  imageWidth: number;
  imageHeight: number;
  faces: readonly FaceRegion[];
  /** Indices the user has un-blurred. Empty means everything is blurred. */
  revealed: ReadonlySet<number>;
  onToggle: (index: number) => void;
};

/**
 * Tappable hotspots laid over the result preview, one per detected face.
 *
 * Positions are percentages of the natural image size, so they track the responsive
 * <img> exactly without any resize listener or measurement — the browser does the
 * scaling for us.
 */
const FaceToggleOverlay: React.FC<Props> = ({ imageWidth, imageHeight, faces, revealed, onToggle }) => {
  if (!imageWidth || !imageHeight) return null;

  // Smallest faces last in DOM order so they paint above larger ones and stay
  // tappable when a big box overlaps them.
  const order = faces
    .map((face, index) => ({ face, index }))
    .sort((a, b) => b.face.width * b.face.height - a.face.width * a.face.height);

  return (
    <div className="absolute inset-0">
      {order.map(({ face, index }) => {
        const isRevealed = revealed.has(index);
        const label = `Face ${index + 1} of ${faces.length}, currently ${isRevealed ? 'visible' : 'blurred'}`;

        return (
          <button
            key={index}
            type="button"
            aria-pressed={isRevealed}
            aria-label={label}
            title={label}
            onClick={() => onToggle(index)}
            style={{
              left: `${(face.x / imageWidth) * 100}%`,
              top: `${(face.y / imageHeight) * 100}%`,
              width: `${(face.width / imageWidth) * 100}%`,
              height: `${(face.height / imageHeight) * 100}%`,
            }}
            className={[
              'absolute flex items-center justify-center rounded-md transition-colors',
              // The hitbox grows to a comfortable tap size on small faces without
              // changing the box itself, so the blurred region is unaffected.
              'before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2',
              'before:min-w-[44px] before:min-h-[44px] before:w-full before:h-full before:content-[""]',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              isRevealed
                ? 'border-2 border-amber-500 bg-amber-500/10 focus:ring-amber-500'
                : 'border-2 border-white/80 bg-transparent hover:bg-white/10 focus:ring-primary-500',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none flex items-center justify-center rounded-full p-1 shadow',
                isRevealed ? 'bg-amber-500 text-white' : 'bg-white/85 text-slate-700',
              ].join(' ')}
            >
              {isRevealed ? <Eye size={14} /> : <EyeOff size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FaceToggleOverlay;
