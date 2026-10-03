import { useEffect, useState } from "react";

/** QR code gerado no próprio navegador (o segredo nunca sai para outro serviço). */
export function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((mod) => mod.toDataURL(value, { margin: 1, width: 200 }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);
  if (!src)
    return (
      <div
        className="h-[200px] w-[200px] rounded-md bg-canvas-inset"
        aria-hidden
      />
    );
  return (
    <img
      src={src}
      width={200}
      height={200}
      alt="QR code para o aplicativo autenticador"
      className="rounded-md bg-white p-1"
    />
  );
}
