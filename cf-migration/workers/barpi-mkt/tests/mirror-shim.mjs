// Тестовий місток: index.js імпортує 'cloudflare:email', якого немає в Node — підміняємо його і вантажимо модуль.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'cloudflare:email') return { url: 'data:text/javascript,export class EmailMessage {}', shortCircuit: true };
  return next(spec, ctx);
}`));
export const { mirrorAdEvent } = await import('../src/index.js');
