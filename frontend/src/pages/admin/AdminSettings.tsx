import { useEffect, useRef, useState } from 'react'
import { Settings, Plus, Trash2, GripVertical, Check, ExternalLink, Upload, Mail, Server, Eye, EyeOff, Send, Copy, Plug, Palette, RotateCcw } from 'lucide-react'
import { adminDonateApi, smtpApi, type SmtpSettings } from '../../services/api'
import { useSiteSettings, parseFooterColumns, applyColors, type FooterColumn, type FooterLink } from '../../store/siteSettingsStore'
import toast from 'react-hot-toast'

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-c-text flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-c-t3" />}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-c-t3 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 ${checked ? 'bg-c-primary' : 'bg-c-bg3 border border-c-border'}`}
          style={{ height: '22px', width: '40px' }}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <div>
        <div className="text-sm text-c-text font-medium">{label}</div>
        {description && <div className="text-xs text-c-t3 mt-0.5">{description}</div>}
      </div>
    </label>
  )
}

function ColorPicker({ label, hint, value, onChange }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
}) {
  const [hex, setHex] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHex(value) }, [value])

  const commit = (raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw
    if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v)
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {/* Swatch — opens native color picker */}
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-lg border-2 border-c-border cursor-pointer shadow-inner transition-transform hover:scale-105"
            style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(hex) ? hex : value }}
            onClick={() => inputRef.current?.click()}
          />
          <input
            ref={inputRef}
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : value}
            onChange={(e) => { setHex(e.target.value); onChange(e.target.value) }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>

        {/* Hex input */}
        <div className="relative flex-1 max-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-c-t3 text-sm font-mono">#</span>
          <input
            type="text"
            maxLength={7}
            value={hex.replace('#', '')}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
              setHex('#' + v)
              if (v.length === 6) commit('#' + v)
            }}
            onBlur={() => commit(hex)}
            className="input pl-7 font-mono uppercase text-sm"
            placeholder="7c3aed"
          />
        </div>

        {/* Reset to passed value */}
        <button
          onClick={() => { setHex(value); onChange(value) }}
          className="text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
          title="Сбросить"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      {hint && <p className="text-xs text-c-t3 mt-1.5">{hint}</p>}
    </div>
  )
}

const SMTP_EMPTY: SmtpSettings = {
  enabled: false, host: '', port: 587, username: '', password: '', fromEmail: '', fromName: 'CraftCMS', ssl: false,
}

export default function AdminSettings() {
  const { settings, update } = useSiteSettings()
  const [saving, setSaving] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Color fields
  const [primaryColor, setPrimaryColor] = useState('#7c3aed')
  const [bgColor, setBgColor] = useState('#0a0a0f')

  // Bridge fields
  const [banKickMessage, setBanKickMessage] = useState('')
  const [bridgeApiKey, setBridgeApiKey] = useState('')

  // General fields
  const [siteName, setSiteName] = useState('')
  const [siteDescription, setSiteDescription] = useState('')
  const [copyrightText, setCopyrightText] = useState('')
  const [disclaimerText, setDisclaimerText] = useState('')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [donateHeaderImageUrl, setDonateHeaderImageUrl] = useState('')
  const [siteUrl, setSiteUrl] = useState('')

  // Footer columns
  const [columns, setColumns] = useState<FooterColumn[]>([])

  // SMTP
  const [smtp, setSmtp] = useState<SmtpSettings>(SMTP_EMPTY)

  useEffect(() => {
    setSiteName(settings.siteName)
    setSiteDescription(settings.siteDescription)
    setCopyrightText(settings.copyrightText)
    setDisclaimerText(settings.disclaimerText)
    setHeroTitle(settings.heroTitle)
    setHeroSubtitle(settings.heroSubtitle)
    setDonateHeaderImageUrl(settings.donateHeaderImageUrl ?? '')
    setSiteUrl(settings.siteUrl ?? 'http://localhost:5173')
    setPrimaryColor(settings.primaryColor ?? '#7c3aed')
    setBgColor(settings.bgColor ?? '#0a0a0f')
    setBanKickMessage(settings.banKickMessage ?? '§cВы заблокированы на этом сервере.\n§7Причина: §f{reason}')
    setBridgeApiKey(settings.bridgeApiKey ?? '')
    setColumns(parseFooterColumns(settings.footerColumnsJson))
  }, [settings])

  useEffect(() => {
    smtpApi.get().then((data) => setSmtp({ ...SMTP_EMPTY, ...data, password: '' })).catch(() => {})
  }, [])

  // ── Column helpers ────────────────────────────────────────────────────

  const addColumn = () => setColumns((c) => [...c, { title: 'Новая колонка', links: [] }])
  const removeColumn = (ci: number) => setColumns((c) => c.filter((_, i) => i !== ci))
  const updateColumnTitle = (ci: number, title: string) =>
    setColumns((c) => c.map((col, i) => (i === ci ? { ...col, title } : col)))
  const addLink = (ci: number) =>
    setColumns((c) => c.map((col, i) => i === ci ? { ...col, links: [...col.links, { label: '', href: '/' }] } : col))
  const removeLink = (ci: number, li: number) =>
    setColumns((c) => c.map((col, i) => i === ci ? { ...col, links: col.links.filter((_, j) => j !== li) } : col))
  const updateLink = (ci: number, li: number, field: keyof FooterLink, value: string) =>
    setColumns((c) => c.map((col, i) =>
      i === ci ? { ...col, links: col.links.map((lnk, j) => j === li ? { ...lnk, [field]: value } : lnk) } : col
    ))

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      await update({
        siteName, siteDescription, copyrightText, disclaimerText,
        heroTitle, heroSubtitle,
        donateHeaderImageUrl: donateHeaderImageUrl || null,
        siteUrl,
        primaryColor,
        bgColor,
        banKickMessage,
        bridgeApiKey,
        footerColumnsJson: JSON.stringify(columns),
      })
      toast.success('Настройки сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleSmtpSave = async () => {
    setSmtpSaving(true)
    try {
      await smtpApi.update(smtp)
      toast.success('SMTP настройки сохранены')
    } catch {
      toast.error('Ошибка сохранения SMTP')
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleSmtpTest = async () => {
    if (!testEmail.trim()) { toast.error('Введите email для теста'); return }
    setTesting(true)
    try {
      const { message } = await smtpApi.test(testEmail.trim())
      toast.success(message)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка отправки'
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  const setS = (k: keyof SmtpSettings, v: unknown) => setSmtp((s) => ({ ...s, [k]: v }))

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Настройки сайта</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      <div className="space-y-5">

        {/* ── Colors ──────────────────────────────────────────────────────── */}
        <Section title="Цветовая схема" icon={Palette}>
          <p className="text-xs text-c-t3 -mt-1">
            Изменения применяются мгновенно для предпросмотра. Нажмите «Сохранить» чтобы зафиксировать.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ColorPicker
              label="Акцентный цвет"
              hint="Кнопки, ссылки, подсветка"
              value={primaryColor}
              onChange={(v) => { setPrimaryColor(v); applyColors(v, bgColor) }}
            />
            <ColorPicker
              label="Цвет фона"
              hint="Базовый тёмный фон сайта"
              value={bgColor}
              onChange={(v) => { setBgColor(v); applyColors(primaryColor, v) }}
            />
          </div>
          {/* Preview chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: 'Кнопка', bg: primaryColor, text: '#fff' },
              { label: 'Фон', bg: bgColor, text: '#fafafa', border: true },
            ].map(({ label, bg, text, border }) => (
              <div
                key={label}
                className="px-4 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: bg, color: text, border: border ? '1px solid rgba(255,255,255,0.15)' : undefined }}
              >
                {label}
              </div>
            ))}
            <button
              onClick={() => { setPrimaryColor('#7c3aed'); setBgColor('#0a0a0f'); applyColors('#7c3aed', '#0a0a0f') }}
              className="px-3 py-1.5 rounded-lg text-xs text-c-t3 hover:text-c-t2 border border-c-border hover:border-c-border-h transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" /> Сбросить к дефолту
            </button>
          </div>
        </Section>

        {/* General */}
        <Section title="Основное" icon={Settings}>
          <Field label="Название сайта">
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="input" placeholder="CraftCMS" />
          </Field>
          <Field label="Описание (отображается в футере под логотипом)">
            <textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)}
              className="input resize-none h-20" placeholder="Описание проекта..." />
          </Field>
        </Section>

        {/* Hero section */}
        <Section title="Главная страница — герой">
          <Field label="Заголовок">
            <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)}
              className="input" placeholder="Модовый проект нового уровня" />
          </Field>
          <Field label="Подзаголовок / описание">
            <textarea value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)}
              className="input resize-none h-24" placeholder="Уникальная сборка модов..." />
          </Field>
        </Section>

        {/* Donate page */}
        <Section title="Страница Донат">
          <Field label="Изображение рядом с заголовком «Донат»">
            <div className="flex gap-2">
              <input value={donateHeaderImageUrl} onChange={(e) => setDonateHeaderImageUrl(e.target.value)}
                className="input flex-1" placeholder="URL изображения или загрузите файл" />
              <label className="flex items-center gap-1.5 px-3 py-2 bg-c-bg2 border border-c-border rounded-lg text-xs text-c-t2 hover:text-c-text transition-colors cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return
                    try { const { url } = await adminDonateApi.uploadImage(f); setDonateHeaderImageUrl(url) }
                    catch { toast.error('Ошибка загрузки') }
                  }} />
              </label>
            </div>
            {donateHeaderImageUrl && (
              <img src={donateHeaderImageUrl} alt="" className="mt-2 h-12 object-contain rounded-lg bg-c-bg3 p-1" />
            )}
          </Field>
        </Section>

        {/* Footer bottom */}
        <Section title="Нижняя строка футера">
          <Field label="Текст копирайта (после © год название)">
            <input value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)}
              className="input" placeholder="Все права защищены." />
          </Field>
          <Field label="Дисклеймер (правая сторона)">
            <input value={disclaimerText} onChange={(e) => setDisclaimerText(e.target.value)}
              className="input" placeholder="Not affiliated with Mojang Studios" />
          </Field>
        </Section>

        {/* Footer columns */}
        <Section title="Колонки футера">
          <p className="text-xs text-c-t3 -mt-2">
            Ссылки начинающиеся с <code className="text-c-t2">/</code> — внутренние (React Router).
            Остальные открываются в новой вкладке.
          </p>
          <div className="space-y-4">
            {columns.map((col, ci) => (
              <div key={ci} className="bg-c-bg2 border border-c-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-c-t3 shrink-0" />
                  <input value={col.title} onChange={(e) => updateColumnTitle(ci, e.target.value)}
                    className="input flex-1 text-sm font-medium" placeholder="Заголовок колонки" />
                  <button onClick={() => removeColumn(ci)}
                    className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 pl-6">
                  {col.links.map((link, li) => (
                    <div key={li} className="flex items-center gap-2">
                      <input value={link.label} onChange={(e) => updateLink(ci, li, 'label', e.target.value)}
                        className="input flex-1 text-sm" placeholder="Текст ссылки" />
                      <input value={link.href} onChange={(e) => updateLink(ci, li, 'href', e.target.value)}
                        className="input flex-1 text-sm font-mono" placeholder="/shop или https://..." />
                      {!link.href.startsWith('/') && link.href.startsWith('http') && (
                        <ExternalLink className="w-3.5 h-3.5 text-c-t3 shrink-0" />
                      )}
                      <button onClick={() => removeLink(ci, li)}
                        className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addLink(ci)}
                    className="flex items-center gap-1.5 text-xs text-c-t3 hover:text-c-primary transition-colors cursor-pointer py-1">
                    <Plus className="w-3.5 h-3.5" /> Добавить ссылку
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addColumn}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-c-border hover:border-c-border-h text-c-t3 hover:text-c-t2 text-sm rounded-xl transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Добавить колонку
          </button>
        </Section>

        {/* ── Email verification ──────────────────────────────────────────── */}
        <Section title="Регистрация и Email" icon={Mail}>
          <Field label="URL сайта" hint="Используется в ссылках подтверждения email. Без слеша в конце.">
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)}
              className="input" placeholder="https://myserver.ru" />
          </Field>
        </Section>

        {/* ── Bridge Plugin ───────────────────────────────────────────────── */}
        <Section title="Bridge Plugin" icon={Plug}>
          <Field label="API ключ плагина" hint="Скопируйте в config.yml плагина. Меняйте только при компрометации.">
            <div className="flex gap-2">
              <input value={bridgeApiKey} onChange={(e) => setBridgeApiKey(e.target.value)}
                className="input font-mono text-xs" placeholder="bridge-api-key" />
              <button type="button" onClick={() => { navigator.clipboard.writeText(bridgeApiKey); toast.success('Скопировано') }}
                className="px-3 py-2 bg-c-bg3 border border-c-border hover:border-c-border-h rounded-lg text-c-t2 hover:text-c-text transition-colors cursor-pointer shrink-0">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </Field>
          <Field label="Сообщение при бане" hint="Поддерживает §-коды цветов. Плейсхолдер {reason} — причина бана.">
            <textarea value={banKickMessage} onChange={(e) => setBanKickMessage(e.target.value)}
              className="input min-h-[72px] resize-y font-mono text-xs"
              placeholder="§cВы заблокированы.\n§7Причина: §f{reason}" />
          </Field>
          <div className="bg-c-bg2 border border-c-border rounded-xl p-3 text-xs text-c-t3 space-y-1">
            <p className="font-medium text-c-t2">Как подключить плагин:</p>
            <p>1. Собери плагин: <code className="text-c-primary">mvn package</code> в папке <code className="text-c-primary">BridgePlugin/</code></p>
            <p>2. Скопируй <code className="text-c-primary">BridgePlugin.jar</code> в <code className="text-c-primary">plugins/</code> сервера</p>
            <p>3. В <code className="text-c-primary">config.yml</code> плагина укажи URL бэкенда и API ключ выше</p>
            <p>4. Перезагрузи сервер. Команда <code className="text-c-primary">/cart</code> выдаёт купленные товары.</p>
          </div>
        </Section>

        <div className="text-xs text-c-t3 text-center pb-2">
          Изменения отображаются сразу после сохранения на всех страницах сайта.
        </div>

        {/* ── SMTP settings (separate save) ──────────────────────────────── */}
        <div className="card rounded-xl p-5 space-y-4 border-c-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-c-text flex items-center gap-2">
              <Server className="w-4 h-4 text-c-t3" />
              SMTP настройки
            </h3>
            <button
              onClick={handleSmtpSave}
              disabled={smtpSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-c-bg3 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {smtpSaving ? 'Сохранение...' : 'Сохранить SMTP'}
            </button>
          </div>

          <Toggle
            checked={smtp.enabled}
            onChange={(v) => setS('enabled', v)}
            label="SMTP включён"
            description="Отправка писем активна"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP хост">
              <input value={smtp.host} onChange={(e) => setS('host', e.target.value)}
                className="input" placeholder="smtp.gmail.com" disabled={!smtp.enabled} />
            </Field>
            <Field label="Порт">
              <input type="number" value={smtp.port} onChange={(e) => setS('port', parseInt(e.target.value) || 587)}
                className="input" placeholder="587" disabled={!smtp.enabled} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Логин (username)">
              <input value={smtp.username} onChange={(e) => setS('username', e.target.value)}
                className="input" placeholder="user@gmail.com" disabled={!smtp.enabled} />
            </Field>
            <Field label="Пароль" hint={smtp.password ? '' : 'Оставьте пустым — не изменится'}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtp.password}
                  onChange={(e) => setS('password', e.target.value)}
                  className="input pr-9"
                  placeholder="••••••••"
                  disabled={!smtp.enabled}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </Field>
          </div>

          <Field label="Имя отправителя">
            <input value={smtp.fromName} onChange={(e) => setS('fromName', e.target.value)}
              className="input" placeholder="CraftCMS" disabled={!smtp.enabled} />
          </Field>

          <Toggle
            checked={smtp.ssl}
            onChange={(v) => setS('ssl', v)}
            label="SSL (465)"
            description="Выключено — использует STARTTLS (порт 587)"
          />

          {/* Test */}
          <div className="pt-2 border-t border-c-border">
            <p className="text-xs text-c-t2 mb-2 font-medium">Тест подключения</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="input flex-1 text-sm"
                placeholder="Отправить тест на email..."
                disabled={!smtp.enabled}
              />
              <button
                onClick={handleSmtpTest}
                disabled={testing || !smtp.enabled}
                className="flex items-center gap-1.5 px-3 py-2 bg-c-bg3 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {testing ? 'Отправка...' : 'Тест'}
              </button>
            </div>
            <p className="text-xs text-c-t3 mt-1.5">Перед тестом сохраните SMTP настройки.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
