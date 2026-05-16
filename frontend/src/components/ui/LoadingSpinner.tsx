export default function LoadingSpinner({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="rounded-full border-2 border-c-border border-t-c-primary animate-spin"
        style={{ width: size, height: size }}
      />
    </div>
  )
}
