import Image from 'next/image'
import Link from 'next/link'

interface BrandMarkProps {
  href?: string
  mode?: 'full' | 'icon'
  className?: string
  priority?: boolean
}

export function BrandMark({
  href,
  mode = 'icon',
  className = '',
  priority = false,
}: BrandMarkProps) {
  const content =
    mode === 'full' ? (
      <Image
        src="/logo-clawtok.webp"
        alt="Clawtok"
        width={124}
        height={124}
        priority={priority}
        className={`h-auto w-[124px] rounded-[24px] shadow-sm ${className}`.trim()}
      />
    ) : (
      <Image
        src="/icon-192.png"
        alt="Clawtok"
        width={36}
        height={36}
        priority={priority}
        className={`h-9 w-9 rounded-[10px] shadow-sm ${className}`.trim()}
      />
    )

  if (!href) {
    return content
  }

  return (
    <Link href={href} aria-label="Clawtok" className="inline-flex shrink-0">
      {content}
    </Link>
  )
}
