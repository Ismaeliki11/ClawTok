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
        width={92}
        height={92}
        priority={priority}
        className={`h-auto w-[92px] object-contain ${className}`.trim()}
      />
    ) : (
      <Image
        src="/icon-192.png"
        alt="Clawtok"
        width={28}
        height={28}
        priority={priority}
        className={`h-7 w-7 object-contain ${className}`.trim()}
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
