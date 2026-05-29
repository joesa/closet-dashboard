'use client'

import { useFormStatus } from 'react-dom'
import { useEffect, useState } from 'react'

interface SubmitButtonProps {
  idleText: string
  pendingText: string
  successText: string
  className?: string
  successDurationMs?: number
}

export default function SubmitButton({ 
  idleText, 
  pendingText, 
  successText, 
  className,
  successDurationMs = 2000
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  const [showSuccess, setShowSuccess] = useState(false)
  const [wasPending, setWasPending] = useState(false)

  useEffect(() => {
    // If it was pending, and now it's not pending, that means it just finished successfully
    if (wasPending && !pending) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), successDurationMs)
      return () => clearTimeout(timer)
    }
    
    if (pending) {
      setWasPending(true)
      setShowSuccess(false)
    }
  }, [pending, wasPending, successDurationMs])

  // Determine button state and text
  const isButtonDisabled = pending || showSuccess
  
  let displayText = idleText
  if (pending) displayText = pendingText
  else if (showSuccess) displayText = successText

  return (
    <button
      type="submit"
      disabled={isButtonDisabled}
      className={`${className || ''} flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {pending && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {showSuccess && (
        <svg className="h-4 w-4 mr-1 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {displayText}
    </button>
  )
}
