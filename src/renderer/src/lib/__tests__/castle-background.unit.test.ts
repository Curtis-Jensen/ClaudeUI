import { describe, expect, it } from 'vitest'
import { textureCss, textureLabel } from '../app-texture'
import { castleSvg } from '../castle-background'

describe('the castle background', () => {
  it('is one svg picture in the chat color', () => {
    const svg = castleSvg(200)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 1600 1000"')
    expect(svg).toContain('hsl(200 ')
  })

  it('is a texture in the list that covers and centres on the window', () => {
    expect(textureLabel('castle')).toBe('Castle')
    const css = textureCss('castle', 27)!
    expect(css.size).toBe('cover')
    expect(css.position).toBe('center')
    expect(textureCss('stars', 27)!.size).toBe('cover')
    expect(textureCss('stars', 27)!.position).toBe('center')
  })

  it('takes its color from the hue', () => {
    expect(textureCss('castle', 27)!.image).not.toBe(textureCss('castle', 225)!.image)
  })
})
