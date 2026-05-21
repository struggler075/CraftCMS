import { useEffect, useRef } from 'react'

const DEFAULT_SKIN = '/default.png'

interface SkinViewerProps {
  skinUrl?: string
  capeUrl?: string
  width?: number
  height?: number
  className?: string
}

export default function SkinViewer({ skinUrl, capeUrl, width = 200, height = 280, className = '' }: SkinViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let destroyed = false

    import('skin3d').then(({ Render, WalkingAnimation }) => {
      if (destroyed || !canvas) return

      if (viewerRef.current?.dispose) {
        viewerRef.current.dispose()
        viewerRef.current = null
      }

      const resolvedSkin = skinUrl || DEFAULT_SKIN

      viewerRef.current = new Render({
        canvas,
        width,
        height,
        skin: resolvedSkin,
        cape: capeUrl ?? undefined,
      })

      // skin3d adds a three.js FXAA post-process pass, whose shader uses
      // texture2D(tex, uv, -100.0) to force mip level 0. On Windows the
      // D3D11/ANGLE backend clamps that to [-16, 15.99] and emits an X4713
      // warning per frame. Skins use NearestFilter anyway — FXAA on a pixel-art
      // texture does nothing visible, so drop the pass to silence the warning.
      const v = viewerRef.current as { composer?: { passes: unknown[] }; fxaaPass?: unknown }
      if (v.composer && v.fxaaPass) {
        v.composer.passes = v.composer.passes.filter((p) => p !== v.fxaaPass)
      }

      viewerRef.current.autoRotate = true
      viewerRef.current.animation = new WalkingAnimation()
    }).catch(console.error)

    return () => {
      destroyed = true
      if (viewerRef.current?.dispose) {
        viewerRef.current.dispose()
      }
      viewerRef.current = null
    }
  }, [skinUrl, capeUrl, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  )
}
