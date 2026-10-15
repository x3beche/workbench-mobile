/**
 * The web build's scrollbars, as the web app draws them (redline-studio
 * frontend/src/styles.css: `* { scrollbar-width: thin; scrollbar-color:
 * var(--tcv-scrollbar-thumb) transparent; }` and the brighter thumb under
 * the mouse): thin, a faint rounded thumb on no track. The -webkit- rules
 * are for browsers without scrollbar-color (Safari).
 */
import { colors } from './tokens';

const ID = 'workbench-scrollbars';

export function css(): string {
  return `
* { scrollbar-width: thin; scrollbar-color: ${colors.scrollThumb} transparent; }
*:hover { scrollbar-color: ${colors.scrollHover} transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; background: transparent; }
::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
::-webkit-scrollbar-thumb { background: ${colors.scrollThumb}; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background-color: ${colors.scrollHover}; }
::-webkit-scrollbar-thumb:active { background-color: ${colors.scrollActive}; }
`;
}

export function installScrollbars(): void {
  if (typeof document === 'undefined' || document.getElementById(ID)) return;
  const el = document.createElement('style');
  el.id = ID;
  el.textContent = css();
  document.head.appendChild(el);
}
