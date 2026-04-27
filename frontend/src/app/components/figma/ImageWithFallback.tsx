import React, { useState } from 'react'

// Inline data URI — bundled with the app, no external dependency, can never fail to load.
const ERROR_IMG_SRC =
  'data:image/svg+xml,%3Csvg%20width%3D%2288%22%20height%3D%2288%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%3E%3Crect%20width%3D%2288%22%20height%3D%2288%22%20fill%3D%22%23f3f4f6%22%2F%3E%3Crect%20x%3D%2216%22%20y%3D%2220%22%20width%3D%2256%22%20height%3D%2248%22%20rx%3D%225%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%223%22%2F%3E%3Cpath%20d%3D%22M16%2052%2032%2036%2050%2054%2062%2044%2072%2052%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%223%22%20stroke-linejoin%3D%22round%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2232%22%20r%3D%226%22%20fill%3D%22%239ca3af%22%2F%3E%3C%2Fsvg%3E'

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  return (
    <img
      src={didError ? ERROR_IMG_SRC : src}
      alt={alt}
      className={className}
      style={style}
      {...rest}
      onError={didError ? undefined : handleError}
      data-original-url={didError ? src : undefined}
    />
  )
}
