export default function PDFDisplay({ url }: { url: string }) {
  return (
    <object data={url} type="application/pdf" className="w-full block h-full">
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        Open problem statement
      </a>
    </object>
  );
}
