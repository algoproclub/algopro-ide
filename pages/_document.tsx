import { Head, Html, Main, NextScript } from 'next/document';

const themeInitializationScript = `
  (function () {
    try {
      var theme = window.localStorage.getItem('algopro-theme');

      if (theme !== 'light' && theme !== 'dark') {
        theme = 'dark';
      }

      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      // The CSS root defaults keep dark mode usable when storage is unavailable.
    }
  })();
`;

export default function Document(): JSX.Element {
  return (
    <Html>
      <Head>
        <script
          id="theme-initialization"
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
