import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'closet-quote-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-contractor-id'?: string;
        'data-api-url'?: string;
        'data-preview-color'?: string;
      };
    }
  }
}
