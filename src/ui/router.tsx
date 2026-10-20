import { useEffect, useState } from 'preact/hooks';

const current = () => (location.hash.replace(/^#/, '') || '/');

export function useRoute(): string {
  const [route, setRoute] = useState(current());
  useEffect(() => {
    const on = () => {
      setRoute(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path: string) {
  location.hash = path;
}

/** Splits "/plan/abc?tree=1" into its path parts and query values. */
export function parseRoute(route: string): { parts: string[]; query: URLSearchParams } {
  const [path, q = ''] = route.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) };
}
