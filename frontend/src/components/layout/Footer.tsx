import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useSiteSettings, parseFooterColumns } from '../../store/siteSettingsStore'
import api from '../../services/api'

interface PaymentLogosState {
  show: boolean
  freekassa: boolean
  unitpay: boolean
  stripe: boolean
  yookassa: boolean
}

export default function Footer() {
  const loaded = useSiteSettings((s) => s.loaded)
  const { siteName, siteDescription, logoUrl, copyrightText, disclaimerText, footerColumnsJson } =
    useSiteSettings((s) => s.settings)
  const [logos, setLogos] = useState<PaymentLogosState | null>(null)

  useEffect(() => {
    if (!loaded) return
    api.get('/settings/payment-logos').then((r) => setLogos(r.data)).catch(() => {})
  }, [loaded])

  if (!loaded) return null

  const columns = parseFooterColumns(footerColumnsJson)
  const showLogos = logos?.show && (logos.freekassa || logos.unitpay || logos.stripe || logos.yookassa)

  return (
    <footer className="border-t border-c-border mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-[2fr_repeat(var(--cols),1fr)] gap-8 mb-10"
          style={{ '--cols': columns.length } as React.CSSProperties}>

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-7 h-7 object-contain rounded-md" />
              ) : (
                <div className="w-7 h-7 bg-c-primary rounded-md flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-semibold text-c-text">{siteName}</span>
            </div>
            <p className="text-sm text-c-t2 leading-relaxed max-w-xs">{siteDescription}</p>
          </div>

          {/* Dynamic columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs text-c-t3 font-medium uppercase tracking-wider mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link to={link.href} className="text-sm text-c-t2 hover:text-c-text transition-colors duration-150">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-c-t2 hover:text-c-text transition-colors duration-150">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment logos */}
        {showLogos && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {logos!.freekassa && (
              <span className="px-2.5 py-1 bg-c-bg2 border border-c-border rounded-md text-[11px] font-semibold text-blue-400 tracking-wide">
                FreeKassa
              </span>
            )}
            {logos!.unitpay && (
              <span className="px-2.5 py-1 bg-c-bg2 border border-c-border rounded-md text-[11px] font-semibold text-purple-400 tracking-wide">
                UnitPay
              </span>
            )}
            {logos!.stripe && (
              <span className="px-2.5 py-1 bg-c-bg2 border border-c-border rounded-md text-[11px] font-semibold text-indigo-400 tracking-wide">
                Stripe
              </span>
            )}
            {logos!.yookassa && (
              <span className="px-2.5 py-1 bg-c-bg2 border border-c-border rounded-md text-[11px] font-semibold text-yellow-400 tracking-wide">
                ЮKassa
              </span>
            )}
          </div>
        )}

        <div className="divider mb-5" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-c-t3">
          <span>&copy; {new Date().getFullYear()} {siteName}. {copyrightText}</span>
          <span>{disclaimerText}</span>
        </div>
      </div>
    </footer>
  )
}
