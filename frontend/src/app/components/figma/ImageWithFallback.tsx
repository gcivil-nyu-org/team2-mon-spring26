import React, { useState } from 'react'

const ERROR_IMG_SRC =
  'https://i.natgeofe.com/n/04cf2a79-4a49-45eb-90f8-38356167690d/image00037.jpeg'

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
