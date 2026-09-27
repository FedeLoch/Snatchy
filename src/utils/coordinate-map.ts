export interface SourceDims {
  width: number;
  height: number;
}
export interface SilhouetteDims {
  centerX: number;
  centerY: number;
  topY: number;
  corridorHalfWidth: number;
}
export interface DataRange {
  minY: number;
  maxY: number;
}

export function mapFrameToSilhouette(
  x: number,
  y: number,
  source: SourceDims,
  target: SilhouetteDims,
  dataRange: DataRange,
  horizontalScaleFactor = 2.0,
): { x: number; y: number } {
  const horizScale = (target.corridorHalfWidth * horizontalScaleFactor) / source.width;
  const svgX = target.centerX + (x - source.width / 2) * horizScale;

  const ySpan = Math.max(1, dataRange.maxY - dataRange.minY);
  const normY = (dataRange.maxY - y) / ySpan;
  const svgY = target.centerY - normY * (target.centerY - target.topY);

  return {
    x: Math.max(120, Math.min(260, svgX)),
    y: svgY,
  };
}