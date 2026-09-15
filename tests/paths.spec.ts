/**
 * Path helper contracts.
 *
 * These mirror better-sidebar's own client-side helpers, and the mirroring is
 * the point: if `isAbsolutePath` is narrower than the host's, a path the host
 * would resolve verbatim gets silently joined onto the cwd and lands somewhere
 * else entirely. Several cases below are direct regressions of that class of
 * bug rather than hypotheticals.
 */
import { describe, expect, it } from 'vitest'
import {
  baseName,
  isAbsolutePath,
  isInsideWorkspace,
  isRemoteUrl,
  isWithinWorkspace,
  normalizeLocalPath,
  resolveMediaRef,
} from '../src/client/canvas/paths'

describe('isAbsolutePath — must be a SUPERSET of the host notion', () => {
  it.each([
    ['POSIX root', '/home/u/a.png'],
    ['Windows drive, backslash', 'C:\\Users\\u\\a.png'],
    ['Windows drive, forward slash', 'C:/Users/u/a.png'],
    ['lowercase drive', 'd:/x.png'],
    ['UNC, backslash', '\\\\server\\share\\a.png'],
    ['UNC, forward slash', '//server/share/a.png'],
  ])('accepts %s', (_label, path) => {
    expect(isAbsolutePath(path)).toBe(true)
  })

  it.each([
    ['bare name', 'a.png'],
    ['dot-relative', './a.png'],
    ['parent-relative', '../a.png'],
    ['nested relative', 'try/a.png'],
    ['drive-relative (host rejects this too)', 'C:a.png'],
  ])('rejects %s', (_label, path) => {
    expect(isAbsolutePath(path)).toBe(false)
  })
})

describe('isRemoteUrl — a scheme URL, but not a drive letter', () => {
  it.each(['http://x/a.png', 'https://x/a.png', 'data:image/png;base64,AA', 'mailto:a@b'])(
    'accepts %s',
    dest => expect(isRemoteUrl(dest)).toBe(true),
  )

  it('rejects a Windows drive path despite its `C:` prefix', () => {
    expect(isRemoteUrl('C:\\Users\\a.png')).toBe(false)
    expect(isRemoteUrl('C:/Users/a.png')).toBe(false)
  })

  it('rejects a relative path', () => {
    expect(isRemoteUrl('./a.png')).toBe(false)
  })
})

describe('normalizeLocalPath — the ROOT must survive normalisation', () => {
  it('keeps a Windows drive prefix', () => {
    // The regression this guards: a naive join produces `dir/C:/x.png`, which
    // looks relative and sails past any leading-drive-letter check.
    expect(normalizeLocalPath('C:/secrets/../secrets/x.png')).toBe('C:\\secrets\\x.png')
  })

  it('keeps a POSIX root', () => {
    expect(normalizeLocalPath('/a/./b/../c.png')).toBe('/a/c.png')
  })

  it('keeps a UNC prefix', () => {
    expect(normalizeLocalPath('\\\\server\\share\\a\\..\\b.png')).toBe('\\\\server\\share\\b.png')
  })

  it('collapses dot segments in a relative path without inventing a root', () => {
    expect(normalizeLocalPath('try/./sub/../shot.png')).toBe('try/shot.png')
  })
})

describe('isWithinWorkspace — separator and case tolerant, prefix-safe', () => {
  it('accepts the base itself', () => {
    expect(isWithinWorkspace('E:\\ws', 'E:\\ws')).toBe(true)
  })

  it('tolerates mixed separators and case', () => {
    expect(isWithinWorkspace('E:\\ws', 'e:/ws/try/a.png')).toBe(true)
    expect(isWithinWorkspace('E:/ws', 'E:\\WS\\try\\a.png')).toBe(true)
  })

  it('does not confuse a sibling directory for a child', () => {
    // `E:\ws-evil` must NOT count as inside `E:\ws` — the classic prefix bug.
    expect(isWithinWorkspace('E:\\ws', 'E:\\ws-evil\\a.png')).toBe(false)
  })

  it('rejects an unrelated root', () => {
    expect(isWithinWorkspace('E:\\ws', 'C:/Windows/win.ini')).toBe(false)
  })
})

describe('isInsideWorkspace — our unconditional fence', () => {
  it('lets a relative path through (the host resolves it under the cwd)', () => {
    expect(isInsideWorkspace('E:\\ws', 'try/a.canvas.tsx')).toBe(true)
    expect(isInsideWorkspace(undefined, 'try/a.canvas.tsx')).toBe(true)
  })

  it('accepts an absolute path inside the workspace', () => {
    expect(isInsideWorkspace('E:\\ws', 'E:\\ws\\try\\a.canvas.tsx')).toBe(true)
  })

  it('refuses an absolute path outside it', () => {
    expect(isInsideWorkspace('E:\\ws', 'C:/Windows/win.ini')).toBe(false)
  })

  it('refuses an absolute path when the cwd is unknown', () => {
    expect(isInsideWorkspace(undefined, 'E:\\ws\\a.canvas.tsx')).toBe(false)
  })
})

describe('resolveMediaRef — one canvasImage() reference to one local path', () => {
  it('resolves a relative reference against the canvas file directory', () => {
    expect(resolveMediaRef('./shot.png', 'try/report.canvas.tsx')).toBe('try/shot.png')
    expect(resolveMediaRef('img/shot.png', 'try/report.canvas.tsx')).toBe('try/img/shot.png')
  })

  it('walks up out of the directory', () => {
    expect(resolveMediaRef('../assets/shot.png', 'try/sub/report.canvas.tsx')).toBe('try/assets/shot.png')
  })

  it('leaves an absolute reference absolute — never joins it onto the directory', () => {
    // The exact regression: `try/` + `C:/secrets/x.png` must not become
    // `try/C:/secrets/x.png`, which reads as relative and dodges the fence.
    const resolved = resolveMediaRef('C:/secrets/x.png', 'try/report.canvas.tsx')
    expect(resolved).toBe('C:\\secrets\\x.png')
    expect(isAbsolutePath(resolved as string)).toBe(true)
    expect(isInsideWorkspace('E:\\ws', resolved as string)).toBe(false)
  })

  it('passes a remote URL straight through', () => {
    expect(resolveMediaRef('https://x/a.png', 'try/r.canvas.tsx')).toBe('https://x/a.png')
    expect(resolveMediaRef('data:image/png;base64,AA', 'try/r.canvas.tsx')).toBe('data:image/png;base64,AA')
  })

  it('returns undefined for an empty reference or an anchor', () => {
    expect(resolveMediaRef('', 'try/r.canvas.tsx')).toBeUndefined()
    expect(resolveMediaRef('   ', 'try/r.canvas.tsx')).toBeUndefined()
    expect(resolveMediaRef('#frag', 'try/r.canvas.tsx')).toBeUndefined()
  })
})

describe('baseName', () => {
  it('handles both separators', () => {
    expect(baseName('try/report.canvas.tsx')).toBe('report.canvas.tsx')
    expect(baseName('try\\report.canvas.tsx')).toBe('report.canvas.tsx')
    expect(baseName('report.canvas.tsx')).toBe('report.canvas.tsx')
  })
})
