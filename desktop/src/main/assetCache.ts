/**
 * Lumen · Cache de assets en disco (proceso MAIN).
 * ────────────────────────────────────────────────
 * Objetivo (lane LATENCY): proyección instantánea. En vez de que el renderer
 * descargue media on-demand al proyectar (fetch→blob, con delay visible la
 * primera vez y sin sobrevivir reinicios), el proceso main mantiene un cache
 * en DISCO de los assets remotos (imágenes/videos usados como media Y como
 * fondos de canción). Los assets se "calientan" en el preload y persisten
 * entre reinicios de la app.
 *
 * Contrato:
 *   • ensureCached(url): descarga UNA vez (clave = hash de la URL, preservando
 *     extensión), lo guarda en disco y devuelve una ruta `file://` local. En
 *     llamadas repetidas devuelve la ruta cacheada sin re-descargar. Ante
 *     cualquier fallo (red/offline) devuelve la URL original para que el caller
 *     pueda usar fallback.
 *   • prefetch(url): calienta el cache en background (fire-and-forget).
 *
 * TODO todo está protegido para que NUNCA lance una excepción hacia el main.
 */

import { app } from "electron";
import { createHash } from "crypto";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import { pathToFileURL } from "url";

// Máximo de redirects HTTP a seguir antes de rendirse.
const MAX_REDIRECTS = 5;

// Descargas en curso: URL → promesa. Evita descargas concurrentes duplicadas
// del mismo asset (p. ej. prefetch + resolveAsset casi simultáneos).
const inFlight = new Map<string, Promise<string>>();

let cacheDirPromise: Promise<string> | null = null;

/** Directorio del cache: `<userData>/asset-cache`. Se crea una sola vez. */
async function getCacheDir(): Promise<string> {
  if (!cacheDirPromise) {
    cacheDirPromise = (async () => {
      const dir = path.join(app.getPath("userData"), "asset-cache");
      await fsp.mkdir(dir, { recursive: true });
      return dir;
    })().catch((err) => {
      // Reset para reintentar en la próxima llamada si mkdir falló.
      cacheDirPromise = null;
      throw err;
    });
  }
  return cacheDirPromise;
}

/** ¿Es una URL http(s) remota? Sólo esas se cachean; lo demás pasa tal cual. */
function isRemoteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Extensión "segura" derivada del pathname de la URL (ignora querystring).
 * Devuelve algo como ".jpg"/".mp4" o "" si no hay una extensión sensata.
 */
function safeExtFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const ext = path.extname(pathname);
    // Sólo aceptar extensiones alfanuméricas cortas (evita basura de la URL).
    if (/^\.[A-Za-z0-9]{1,8}$/.test(ext)) return ext.toLowerCase();
  } catch {
    /* URL inválida → sin extensión */
  }
  return "";
}

/** Nombre de archivo determinista: sha256(url) + extensión preservada. */
function cacheFileName(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return `${hash}${safeExtFromUrl(url)}`;
}

/**
 * Descarga `url` a `destPath` de forma atómica (escribe a un temporal y hace
 * rename). Sigue redirects. Rechaza ante error de red / status != 2xx.
 */
function download(url: string, destPath: string, redirectsLeft: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    let mod: typeof http | typeof https;
    try {
      mod = new URL(url).protocol === "http:" ? http : https;
    } catch (e) {
      done(e as Error);
      return;
    }

    const req = mod.get(url, (res) => {
      const status = res.statusCode ?? 0;

      // Redirects.
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume(); // drenar
        if (redirectsLeft <= 0) {
          done(new Error(`Too many redirects for ${url}`));
          return;
        }
        const next = new URL(res.headers.location, url).href;
        download(next, destPath, redirectsLeft - 1).then(() => done(), done);
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume(); // drenar
        done(new Error(`HTTP ${status} for ${url}`));
        return;
      }

      // Escribir a un temporal único y luego renombrar (atómico en el mismo FS).
      const tmpPath = `${destPath}.${process.pid}.${Date.now()}.tmp`;
      const out = fs.createWriteStream(tmpPath);

      const cleanupTmp = () => {
        fs.unlink(tmpPath, () => {
          /* best-effort */
        });
      };

      res.on("error", (err) => {
        out.destroy();
        cleanupTmp();
        done(err);
      });
      out.on("error", (err) => {
        cleanupTmp();
        done(err);
      });
      out.on("finish", () => {
        fs.rename(tmpPath, destPath, (err) => {
          if (err) {
            cleanupTmp();
            done(err);
          } else {
            done();
          }
        });
      });

      res.pipe(out);
    });

    req.on("error", (err) => done(err));
    // Timeout de red defensivo (30s) para no dejar descargas colgadas.
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Timeout downloading ${url}`));
    });
  });
}

/**
 * Garantiza que `url` está en el cache de disco y devuelve una ruta `file://`
 * local. Si ya está cacheado, devuelve la ruta sin re-descargar. Ante cualquier
 * fallo devuelve la URL original (fallback del caller). NUNCA lanza.
 */
export async function ensureCached(url: string): Promise<string> {
  // Sólo cacheamos http(s). Cualquier otra cosa (file://, data:, vacío) pasa tal cual.
  if (!url || !isRemoteHttpUrl(url)) return url;

  // Coalesce descargas concurrentes del mismo URL.
  const existing = inFlight.get(url);
  if (existing) return existing;

  const task = (async (): Promise<string> => {
    try {
      const dir = await getCacheDir();
      const destPath = path.join(dir, cacheFileName(url));

      // ¿Ya cacheado y no vacío? → servir local sin descargar.
      try {
        const st = await fsp.stat(destPath);
        if (st.isFile() && st.size > 0) {
          return pathToFileURL(destPath).href;
        }
      } catch {
        /* no existe → descargar */
      }

      await download(url, destPath, MAX_REDIRECTS);
      return pathToFileURL(destPath).href;
    } catch (err) {
      // Fallback silencioso a la URL remota (offline / error de red / disco).
      console.warn(`[assetCache] ensureCached falló para ${url}: ${(err as Error)?.message}`);
      return url;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, task);
  return task;
}

/**
 * Calienta el cache en background (fire-and-forget). No espera ni propaga
 * errores: úsalo en preload para que el asset esté listo antes de proyectar.
 */
export function prefetch(url: string): void {
  try {
    if (!url || !isRemoteHttpUrl(url)) return;
    void ensureCached(url).catch(() => {
      /* ya logueado dentro de ensureCached */
    });
  } catch {
    /* jamás lanzar hacia el main */
  }
}
