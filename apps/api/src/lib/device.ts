/** Rótulo curto do dispositivo para a lista de acessos ("Chrome no Android"). Sem guardar o user-agent inteiro. */
export function describeDevice(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  if (!ua) return 'Dispositivo desconhecido';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';

  const system = /iPhone|iPad|iPod/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;

  return system ? `${browser} no ${system}` : browser;
}
