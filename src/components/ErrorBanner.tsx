import { AlertCircle } from 'lucide-react'

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md flex items-start gap-3 my-4 border border-destructive/20">
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="text-sm font-medium">{message}</div>
    </div>
  )
}
