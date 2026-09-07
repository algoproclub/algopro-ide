import Head from 'next/head';
import GuideContent from '../docs/online-ide-users-guide.mdx';
import { guideMdxComponents } from '../docs/components/GuideMdxComponents';

export default function DocsPage(): JSX.Element {
  return (
    <>
      <Head>
        <title>Online IDE felhasználói útmutató</title>
        <meta
          name="description"
          content="Az Algo Pro és a MATFIN Online IDE útmutatója tanulóknak és tanároknak."
        />
      </Head>
      <div className="online-ide-guide-page min-h-full overflow-auto bg-canvas text-content">
        <GuideContent components={guideMdxComponents} />
      </div>
    </>
  );
}
