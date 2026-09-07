import { useEffect, useState } from 'react';

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'AlgoPro IDE';
const isMatfin = productName === 'MATFIN IDE';

type LogoProps = {
  alt?: string;
  className?: string;
};

export default function Logo({ alt = '', className }: LogoProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const src = isMatfin
    ? theme === 'light'
      ? '/logo-matfin.png'
      : '/logo-matfin-dark.png'
    : '/logo.png';

  return (
    <img src={src} alt={alt} width={180} height={180} className={className} />
  );
}
