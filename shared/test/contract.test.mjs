/**
 * NOVA · Conformance del contrato de fidelidad
 * ─────────────────────────────────────────────
 * Corre sobre el OUTPUT COMPILADO (`../dist/index.js`) para verificar que el
 * comportamiento observable del paquete no cambie sin que un test falle.
 * Una regresión en los defaults de resolveTypography (p. ej. color undefined)
 * rompe estos asserts.
 *
 * Runner: node --test (built-in). Sin dependencias externas.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// dist es CommonJS (module: CommonJS en tsconfig.build.json); el default import
// da el module.exports con todos los símbolos re-exportados desde index.
import pkg from '../dist/index.js';

const {
  resolveTypography,
  transitionDurationMs,
  novaSizeToVw,
  parseClientMessage,
  TRANSITION_MS,
  NOVA_REFERENCE_WIDTH,
} = pkg;

test('resolveTypography({}) devuelve objeto COMPLETO con defaults', () => {
  const t = resolveTypography({});
  // color nunca undefined — la queja original que este contrato arregla.
  assert.equal(t.color, '#FFFFFF');
  assert.equal(t.fontFamily, 'Inter');
  // Completo: ningún campo del contrato queda sin definir.
  for (const key of [
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
    'letterSpacing', 'color', 'textShadow', 'textTransform', 'textAlign',
  ]) {
    assert.ok(key in t, `falta la clave ${key}`);
  }
  assert.notEqual(t.color, undefined);
});

test('resolveTypography preserva valores provistos', () => {
  const t = resolveTypography({
    color: '#ff0000',
    fontFamily: 'Poppins',
    textTransform: 'uppercase',
  });
  assert.equal(t.color, '#ff0000');
  assert.equal(t.fontFamily, 'Poppins');
  assert.equal(t.textTransform, 'uppercase');
});

test('resolveTypography limita fontWeight/fontSize fuera de rango', () => {
  const hi = resolveTypography({ fontWeight: 5000, fontSize: 99999 });
  assert.equal(hi.fontWeight, 900);
  assert.equal(hi.fontSize, 400);

  const lo = resolveTypography({ fontWeight: -100, fontSize: 1 });
  assert.equal(lo.fontWeight, 100);
  assert.equal(lo.fontSize, 12);
});

test('transitionDurationMs coincide con TRANSITION_MS', () => {
  assert.equal(transitionDurationMs('fade'), 400);
  assert.equal(transitionDurationMs('fade-slow'), 800);
  assert.equal(transitionDurationMs('none'), 0);
  assert.equal(transitionDurationMs(undefined), 0);

  assert.equal(transitionDurationMs('fade'), TRANSITION_MS['fade']);
  assert.equal(transitionDurationMs('fade-slow'), TRANSITION_MS['fade-slow']);
  assert.equal(transitionDurationMs('none'), TRANSITION_MS['none']);
});

test('novaSizeToVw(1920) === 100 (ancho de referencia)', () => {
  assert.equal(novaSizeToVw(1920), 100);
  assert.equal(novaSizeToVw(NOVA_REFERENCE_WIDTH), 100);
});

test('parseClientMessage acepta un display-slide plano válido', () => {
  const msg = { type: 'display-slide', screen: 'main', slide: { type: 'verse' } };
  const parsed = parseClientMessage(msg);
  assert.notEqual(parsed, null);
  assert.equal(parsed.type, 'display-slide');
  assert.equal(parsed.screen, 'main');
  assert.equal(parsed.slide.type, 'verse');
});

test('parseClientMessage rechaza basura → null', () => {
  assert.equal(parseClientMessage({ foo: 1 }), null);
  assert.equal(parseClientMessage(null), null);
  assert.equal(parseClientMessage('display-slide'), null);
  // type válido pero faltan campos requeridos
  assert.equal(parseClientMessage({ type: 'display-slide' }), null);
  assert.equal(parseClientMessage({ type: 'display-slide', screen: 'bogus', slide: { type: 'verse' } }), null);
});
