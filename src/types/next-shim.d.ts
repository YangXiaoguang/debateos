declare module 'next' {
  export type NextConfig = Record<string, unknown>;

  export interface Metadata {
    title?: string;
    description?: string;
  }
}

declare module 'next/link' {
  import type { AnchorHTMLAttributes, DetailedHTMLProps, ReactNode } from 'react';

  type LinkProps = DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
  };

  export default function Link(props: LinkProps): JSX.Element;
}

declare module 'next/navigation' {
  export function notFound(): never;
  export function useRouter(): {
    push(href: string): void;
    replace(href: string): void;
    refresh(): void;
  };
}

declare module 'next/font/google' {
  export function Space_Grotesk(options: Record<string, unknown>): { variable: string };
  export function IBM_Plex_Mono(options: Record<string, unknown>): { variable: string };
}
