// src/features/charity/CharityImage.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';

interface CharityImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
}

export function CharityImage({ 
  src, 
  alt, 
  className = "", 
  width = 40, 
  height = 40,
  fill = false,
  sizes = "40px"
}: CharityImageProps) {
  const [error, setError] = useState(false);
  
  // If we don't have a src or there was an error loading it, show fallback
  if (!src || error) {
    return (
      <div 
        className={`${className} bg-blue-100 text-blue-800 flex items-center justify-center rounded-full`}
        style={{ width: width, height: height, minWidth: width }}
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }
  
  // Otherwise try to load the image
  return (
    <div className="relative" style={fill ? undefined : { width, height }}>
      <Image
        src={src}
        alt={alt}
        className={`${className} object-contain rounded-full`}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        onError={() => setError(true)}
        unoptimized // Use this as a fallback for domain issues
      />
    </div>
  );
}