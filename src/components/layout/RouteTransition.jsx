import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PageLoader } from '../ui/PageLoader'

export default function RouteTransition({ children }) {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <>
      {isLoading && <PageLoader />}
      {/* We don't hide children, we just overlay the loader so the page is ready behind it */}
      <div className={isLoading ? 'hidden' : 'block'}>
        {children}
      </div>
    </>
  )
}
