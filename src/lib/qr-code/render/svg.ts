import type { ResolvedQRCodeConfig } from '../types'
import { buildMatrix } from '../matrix'
import { buildDotsPath } from './dots'
import { buildCornerDotsPath, buildCornerSquaresPath } from './corners'
import { computeImagePlacement, resolveEffectiveErrorCorrectionLevel } from './image'

export interface RenderedQR {
  svg: string
  width: number
  height: number
  matrixCount: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

/**
 * Build the QR portion of an SVG (matrix + corners + logo) at viewBox
 * `0 0 size size`. Returned as a fragment string so the caller can either
 * wrap it in a frame or emit as a standalone SVG.
 */
export function renderQrFragment(config: ResolvedQRCodeConfig): {
  fragment: string
  size: number
  matrixCount: number
} {
  const effectiveEcLevel = resolveEffectiveErrorCorrectionLevel(
    Boolean(config.image),
    config.errorCorrectionLevel
  )
  const { matrix, count } = buildMatrix(config.data, effectiveEcLevel)
  const totalModules = count + 2 * config.margin
  const moduleSize = config.size / totalModules
  const offset = config.margin * moduleSize

  const parts: string[] = []

  const placement = config.image
    ? computeImagePlacement({
        image: config.image,
        count,
        moduleSize,
        offset,
        totalSize: config.size,
        errorCorrectionLevel: effectiveEcLevel
      })
    : undefined

  // Whether the centre logo sits in genuinely open space or on the QR's own
  // background colour is now entirely up to that colour: transparent
  // background means nothing is drawn behind it at all (open space, for
  // free); a solid colour fills straight through, logo area included, so a
  // "with background" QR reads as one consistent surface rather than having
  // an always-punched hole regardless of that setting.
  if (config.background.color && config.background.color !== 'transparent') {
    parts.push(
      `<rect class="qr-bg" x="0" y="0" width="${config.size}" height="${config.size}" fill="${escapeAttr(
        config.background.color
      )}"/>`
    )
  }

  const dotsPath = buildDotsPath({
    matrix,
    count,
    moduleSize,
    offset,
    shape: config.dots.shape,
    hideCell: placement?.hidesCell
  })
  if (dotsPath) {
    parts.push(
      `<path class="qr-dots" fill-rule="evenodd" fill="${escapeAttr(config.dots.color)}" d="${dotsPath}"/>`
    )
  }

  const cornerSquaresPath = buildCornerSquaresPath({
    count,
    moduleSize,
    offset,
    shape: config.cornerSquares.shape
  })
  if (cornerSquaresPath) {
    parts.push(
      `<path class="qr-corner-square" fill-rule="evenodd" fill="${escapeAttr(
        config.cornerSquares.color
      )}" d="${cornerSquaresPath}"/>`
    )
  }

  const cornerDotsPath = buildCornerDotsPath({
    count,
    moduleSize,
    offset,
    shape: config.cornerDots.shape
  })
  if (cornerDotsPath) {
    parts.push(
      `<path class="qr-corner-dot" fill="${escapeAttr(config.cornerDots.color)}" d="${cornerDotsPath}"/>`
    )
  }

  if (placement && config.image) {
    const innerSize = placement.size - 2 * placement.margin
    const innerX = placement.x + placement.margin
    const innerY = placement.y + placement.margin
    if (innerSize > 0) {
      const crossOrigin = config.image.crossOrigin
        ? ` crossorigin="${config.image.crossOrigin}"`
        : ''
      const shape = config.image.shape ?? 'square'
      // Fixed id, not per-instance: matches the existing convention for
      // 'frame-bg-clip' / 'qr-export-clip' elsewhere in this file — each export
      // renders one detached SVG at a time, so document-wide uniqueness never
      // comes up in practice.
      const clipId = 'qr-logo-clip'
      let clipDefs = ''
      let clipAttr = ''
      if (shape === 'circle') {
        const cx = innerX + innerSize / 2
        const cy = innerY + innerSize / 2
        const r = innerSize / 2
        clipDefs = `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`
        clipAttr = ` clip-path="url(#${clipId})"`
      }
      parts.push(
        `${clipDefs}<image class="qr-logo" href="${escapeAttr(config.image.href)}" xlink:href="${escapeAttr(
          config.image.href
        )}" x="${innerX}" y="${innerY}" width="${innerSize}" height="${innerSize}" preserveAspectRatio="xMidYMid meet" data-shape="${shape}"${clipAttr}${crossOrigin}/>`
      )
    }
  }

  return { fragment: parts.join(''), size: config.size, matrixCount: count }
}

/**
 * Compose the QR fragment into a complete `<svg>` document. No frame applied.
 */
export function wrapAsSvg(fragment: string, width: number, height: number): string {
  return (
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">${fragment}</svg>`
  )
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
