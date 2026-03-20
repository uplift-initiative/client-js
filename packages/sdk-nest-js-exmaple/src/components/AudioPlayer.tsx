export function AudioPlayer({ src }: { src: string | null }) {
  if (!src) return null;

  return (
    <audio controls className="w-full mt-4">
      <source src={src} />
    </audio>
  );
}
