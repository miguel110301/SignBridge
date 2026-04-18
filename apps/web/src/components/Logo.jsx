import React from 'react'
import { Link } from 'react-router-dom'

export default function Logo({ className = '', withText = true, size = 'md' }) {
  const sizes = {
    sm: 'h-6',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16'
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl'
  }

  return (
    <Link to="/" className={`flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95 ${className}`}>
      {/* 
        This references the logo.png that you should save in:
        apps/web/public/logo.png
      */}
      <img 
        src="/logo.png" 
        alt="SignBridge Logo" 
        className={`${sizes[size]} w-auto object-contain drop-shadow-sm`} 
        onError={(e) => {
          // Fallback if logo.png is not yet in the public folder
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      {/* Fallback Icon if Image Fails */}
      <div 
        className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-950 text-white text-sm font-bold shadow-md"
        style={{ display: 'none' }}
      >
        <span className="text-accent-400 font-extrabold">S</span>
        <span className="text-tertiary-400">B</span>
      </div>

      {withText && (
        <span className={`font-extrabold tracking-tight text-brand-950 dark:text-white ${textSizes[size]}`}>
          SIGN<span className="font-medium text-brand-700 dark:text-brand-300">BRIDGE</span>
        </span>
      )}
    </Link>
  )
}
