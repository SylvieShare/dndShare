import { describe, expect, it } from 'vitest'
import { roughRowPaintStyle, roughRowSeamPath } from './roughRowSeam'

describe('adjoining roster paint contours',()=>{
  it('keeps five stable, distinct separators and repeats them without generating new paint',()=>{
    expect(new Set(Array.from({length:5},(_,i)=>roughRowSeamPath(i))).size).toBe(5)
    expect(roughRowSeamPath(5)).toBe(roughRowSeamPath(0))
    expect(roughRowSeamPath(-1)).toBe(roughRowSeamPath(4))
    expect(roughRowPaintStyle(5)).toBe(roughRowPaintStyle(0))
    expect(roughRowPaintStyle(5,true)).toBe(roughRowPaintStyle(0,true))
    expect(roughRowPaintStyle(0,true)['--roster-paint-clip']).not.toBe(roughRowPaintStyle(0)['--roster-paint-clip'])
    expect(roughRowPaintStyle(0,true)['--roster-color-edge-clip']).toContain('3 * var(--layout-border)')
  })

  it('docks both paint edges onto their visible separator at different row heights',()=>{
    for(const roughSides of [false,true])for(let i=0;i<5;i++)for(const height of [72,133,247]){
      const clip=roughRowPaintStyle(i,roughSides)['--roster-paint-clip']
      const top=[...clip.matchAll(/([\d.]+)% calc\(var\(--spacing-small\) \* ([\d.]+)\)/g)].map(m=>[+m[1],-4+8*+m[2]])
      const bottom=[...clip.matchAll(/([\d.]+)% calc\(100% - var\(--spacing-small\) \* ([\d.]+)\)/g)].reverse().map(m=>[+m[1],height+4-8*+m[2]])
      for(const [actual,variant,offset] of [[top,i,0],[bottom,i+1,height]]){
        const line=[...roughRowSeamPath(variant).matchAll(/[ML](\d+) (-?\d+)/g)].map(m=>[+m[1]/10,offset+8*+m[2]/100])
        expect(actual.length).toBe(line.length)
        actual.forEach((point,j)=>{expect(point[0]).toBe(line[j][0]);expect(point[1]).toBeCloseTo(line[j][1],8)})
      }
    }
  })
})
