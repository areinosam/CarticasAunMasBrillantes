import { useState } from 'react'

interface CardImageProps {
  src?: string
  alt: string
  className?: string
  size?: 'small' | 'normal' | 'large'
}

export function CardImage({ src, alt, className = '', size = 'normal' }: CardImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const sizeClasses = {
    small: 'w-24 h-34',
    normal: 'w-full h-full',
    large: 'w-full h-full'
  }

  if (!src || error) {
    return (
      <div className={`${sizeClasses[size]} bg-magic-card flex items-center justify-center rounded-lg border border-magic-card ${className}`}>
        <div className="text-center p-2">
          <div className="text-3xl mb-1">🃏</div>
          <div className="text-magic-text text-xs opacity-60 break-words max-w-[80px] leading-tight">{alt}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-magic-card animate-pulse rounded-lg" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  )
}
