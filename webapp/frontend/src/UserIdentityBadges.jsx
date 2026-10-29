import { Crown } from 'lucide-react'

function VerifiedMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M12 1.9 14.62 4l3.35-.12.93 3.22 2.74 1.94-1.14 3.13 1.14 3.13-2.74 1.94-.93 3.22-3.35-.12L12 22.1l-2.62-2.1-3.35.12-.93-3.22-2.74-1.94 1.14-3.13L2.36 8.7 5.1 6.76l.93-3.22L9.38 3.66 12 1.9Z" />
      <path d="m8.05 12.05 2.42 2.42 5.48-5.48" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  )
}

/** Insignias compactas, mostradas solo cuando el perfil trae estados verificables. */
export function UserIdentityBadges({ profile, compact = true, className = '' }) {
  const verified = Boolean(profile?.is_verified || profile?.kyc_status === 'approved')
  const gold = Boolean(profile?.is_vip || profile?.vip_badge || profile?.vip_plan)

  if (!verified && !gold) return null

  return (
    <span className={`fs-user-identity-badges inline-flex shrink-0 items-center gap-1 ${className}`}>
      {verified && (
        <span title="Cuenta verificada" aria-label="Cuenta verificada" className="fs-user-badge-verified inline-flex items-center justify-center rounded-full">
          <VerifiedMark />
          {!compact && <span className="ml-1">Verificado</span>}
        </span>
      )}
      {gold && (
        <span title="Francho Gold activo" aria-label="Francho Gold activo" className="fs-user-badge-gold inline-flex items-center justify-center rounded-full">
          <Crown className="h-3.5 w-3.5" fill="currentColor" stroke="#9b6500" strokeWidth={2.1} />
          {!compact && <span className="ml-1">Gold</span>}
        </span>
      )}
    </span>
  )
}
