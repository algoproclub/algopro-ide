import Head from 'next/head';

type PageTitleProps = {
  children?: string | null;
};

export default function PageTitle({ children }: PageTitleProps) {
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'AlgoPro IDE';
  const title = children ? `${children} - ${productName}` : productName;

  return (
    <Head>
      <title>{title}</title>
    </Head>
  );
}
