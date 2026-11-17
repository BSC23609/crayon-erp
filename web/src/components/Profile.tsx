/** A trapezoidal roof-sheet section with exactly six ribs: the one decorative motif in the app.
 *  `layers` repeats it stepping up and to the right, like the stacked frames in the Crayon logo. */
export function ProfileLine({ width = 600, rib = 6, layers = 1, className = '', stroke = 'currentColor' }:
  { width?: number; rib?: number; layers?: number; className?: string; stroke?: string }) {
  const pitch = width / rib, h = pitch * 0.3, top = pitch * 0.26, slope = pitch * 0.12
  const pan = (pitch - top - 2 * slope) / 2
  const pts: string[] = []
  for (let i = 0; i < rib; i++) {
    const x = i * pitch
    pts.push(`${x},${h}`, `${x + pan},${h}`, `${x + pan + slope},0`, `${x + pan + slope + top},0`, `${x + pan + 2 * slope + top},${h}`)
  }
  pts.push(`${width},${h}`)
  const dx = pitch * 0.11, dy = h * 0.62
  const W = width + (layers - 1) * dx, H = h + (layers - 1) * dy
  return (
    <svg viewBox={`-2 ${-(layers - 1) * dy - 2} ${W + 4} ${H + 4}`} className={className} aria-hidden="true">
      {Array.from({ length: layers }, (_, k) => (
        <polyline key={k} points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={k === 0 ? 2 : 1.25}
          strokeLinejoin="round" opacity={layers === 1 ? 1 : 1 - k * (0.85 / layers)}
          transform={`translate(${k * dx} ${-k * dy})`} />
      ))}
    </svg>
  )
}
