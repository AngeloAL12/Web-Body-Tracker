export function calcAngle(
  a: MPLandmark,
  b: MPLandmark,
  c: MPLandmark,
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z
  const magBa = Math.hypot(ba.x, ba.y, ba.z)
  const magBc = Math.hypot(bc.x, bc.y, bc.z)
  if (magBa === 0 || magBc === 0) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBa * magBc)))) * (180 / Math.PI)
}

export function landmarkDistance(a: MPLandmark, b: MPLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
