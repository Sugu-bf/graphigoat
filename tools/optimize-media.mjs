#!/usr/bin/env node
/**
 * Prepares media for the web. Run from the project folder (uses the project's sharp):
 *
 *   npm run media -- <files or folders…> [--out public/media] [--widths 640,1024,1600,2400]
 *                    [--avif-quality 52] [--webp-quality 76] [--keep-nodes]
 *
 * Images (jpg, jpeg, png, webp, avif, tif, tiff): AVIF + WebP at every width up to the original's, metadata stripped,
 *   orientation applied; prints the <picture> to paste (width/height set: no layout shift).
 * 3D models (glb, gltf): glTF-Transform optimize: Meshopt geometry, WebP textures up to 2048 px (three's GLTFLoader +
 *   MeshoptDecoder read it; see model-stage). --keep-nodes keeps the node tree (named parts you animate or click).
 * Videos (mp4, mov, m4v, webm): H.264 MP4 without sound, 1080p max, fast start, plus a poster image. Needs ffmpeg.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, extname, join, relative, resolve, sep } from 'node:path'

const require = createRequire(join(process.cwd(), 'package.json'))
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 || args[i + 1] === undefined || args[i + 1].startsWith('--') ? fallback : args[i + 1]
}
const flag = (name) => args.includes(`--${name}`)
const VALUE_FLAGS = new Set(['--out', '--widths', '--avif-quality', '--webp-quality'])
const inputs = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]))
if (!inputs.length) {
  console.log('Usage: npm run media -- <files or folders…> [--out public/media] [--widths 640,1024,1600,2400]')
  process.exit(1)
}

const outDir = resolve(opt('out', 'public/media'))
const widths = String(opt('widths', '640,1024,1600,2400')).split(',').map(Number).filter(Boolean).sort((a, b) => a - b)
const avifQ = Number(opt('avif-quality', 52))
const webpQ = Number(opt('webp-quality', 76))
mkdirSync(outDir, { recursive: true })

const IMG = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'])
const MODEL = new Set(['.glb', '.gltf'])
const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm'])

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(join(p, n))) : [p])
const files = inputs.map((p) => resolve(p)).filter(existsSync).flatMap(walk)
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const publicUrl = (p) => {
  const rel = relative(resolve('public'), p).split(sep).join('/')
  return rel.startsWith('..') ? relative(process.cwd(), p).split(sep).join('/') : `/${rel}`
}
const kb = (bytes) => `${Math.round(bytes / 1024)} ko`
const manifest = []

const images = async (list) => {
  if (!list.length) return
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.error('sharp is missing in this project: npm i -D sharp')
    process.exit(2)
  }
  for (const file of list) {
    const name = slug(basename(file, extname(file)))
    const meta = await sharp(file).metadata()
    const rotated = (meta.orientation ?? 1) >= 5
    const W = rotated ? meta.height : meta.width
    const H = rotated ? meta.width : meta.height
    const sizes = [...new Set([...widths.filter((w) => w < W), Math.min(W, widths[widths.length - 1])])]
    const out = { avif: [], webp: [] }
    for (const w of sizes) {
      const base = sharp(file).rotate().resize({ width: w, withoutEnlargement: true })
      const avif = join(outDir, `${name}-${w}.avif`)
      const webp = join(outDir, `${name}-${w}.webp`)
      await base.clone().avif({ quality: avifQ, effort: 5 }).toFile(avif)
      await base.clone().webp({ quality: webpQ, effort: 5 }).toFile(webp)
      out.avif.push(`${publicUrl(avif)} ${w}w`)
      out.webp.push(`${publicUrl(webp)} ${w}w`)
    }
    const largest = sizes[sizes.length - 1]
    const h = Math.round((H / W) * largest)
    const fallback = publicUrl(join(outDir, `${name}-${largest}.webp`))
    const weight = statSync(join(outDir, `${name}-${largest}.avif`)).size
    manifest.push({ source: file, name, width: largest, height: h, avif: out.avif, webp: out.webp })
    console.log(`\n✓ ${basename(file)} (${W}×${H}) → ${sizes.length} tailles, plus grande en AVIF : ${kb(weight)}`)
    console.log(`<picture>
  <source type="image/avif" srcset="${out.avif.join(', ')}" sizes="100vw" />
  <img src="${fallback}" srcset="${out.webp.join(', ')}" sizes="100vw"
       width="${largest}" height="${h}" alt="" loading="lazy" decoding="async" />
</picture>`)
  }
  console.log('\nAdapter sizes (largeur affichée), écrire un vrai alt. Image du haut de page : retirer loading="lazy",')
  console.log('ajouter fetchpriority="high". Effets WebGL (image-distortion…) : un simple <img> WebP suffit (src + srcset).')
}

const models = (list) => {
  for (const file of list) {
    const out = join(outDir, `${slug(basename(file, extname(file)))}.glb`)
    const extra = flag('keep-nodes') ? ['--flatten', 'false', '--join', 'false'] : []
    console.log(`\n→ ${basename(file)} : glTF-Transform optimize…`)
    const run = spawnSync(
      'npx',
      ['--yes', '@gltf-transform/cli@4.5.1', 'optimize', file, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048', ...extra],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    )
    if (run.status !== 0) {
      console.error('  ✖ optimize failed (see above). Inspect the file on https://gltf.report')
      continue
    }
    console.log(`✓ ${kb(statSync(file).size)} → ${kb(statSync(out).size)} : ${publicUrl(out)}`)
    manifest.push({ source: file, model: publicUrl(out) })
  }
}

const videos = (list) => {
  if (!list.length) return
  const ff = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  if (ff.status !== 0) {
    console.log('\nVidéos : ffmpeg est nécessaire (macOS : brew install ffmpeg), puis relancer.')
    return
  }
  for (const file of list) {
    const name = slug(basename(file, extname(file)))
    const mp4 = join(outDir, `${name}.mp4`)
    const poster = join(outDir, `${name}-poster.jpg`)
    const enc = spawnSync(
      'ffmpeg',
      ['-y', '-i', file, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-vf', "scale='min(1920,iw)':-2", '-movflags', '+faststart', mp4],
      { stdio: 'inherit' },
    )
    if (enc.status !== 0) continue
    spawnSync('ffmpeg', ['-y', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'ignore' })
    console.log(`\n✓ ${basename(file)} → ${kb(statSync(mp4).size)}
<video src="${publicUrl(mp4)}" poster="${publicUrl(poster)}" muted playsinline loop autoplay preload="metadata"></video>
(Vidéo qui boucle : prévoir un bouton pause ou la mettre en pause en mouvement réduit.)`)
    manifest.push({ source: file, video: publicUrl(mp4), poster: publicUrl(poster) })
  }
}

await images(files.filter((f) => IMG.has(extname(f).toLowerCase())))
models(files.filter((f) => MODEL.has(extname(f).toLowerCase())))
videos(files.filter((f) => VIDEO.has(extname(f).toLowerCase())))
const skipped = files.filter((f) => ![...IMG, ...MODEL, ...VIDEO].includes(extname(f).toLowerCase()))
if (skipped.length) console.log(`\nIgnorés (format non géré) : ${skipped.map((f) => basename(f)).join(', ')}`)
writeFileSync(join(outDir, 'media.json'), JSON.stringify(manifest, null, 2) + '\n')
