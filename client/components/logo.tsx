import Image from "next/image";
import logoUrl from "@/app/icon.png";

export function Logo({
  size = 38,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={logoUrl}
      alt="Motion-U logo"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
