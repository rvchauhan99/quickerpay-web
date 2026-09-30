'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TenantSettingsView } from '@quickerpay/shared-types'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, ErrorAlert } from '@/components/ui/PageHeader'
import { FormShell } from '@/components/forms/FormShell'
import { FormSection } from '@/components/forms/FormSection'
import { FormGrid } from '@/components/forms/FormGrid'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Input'
import { apiRequest, ApiClientError } from '@/lib/api'
import {
  accentHexForTheme,
  COLOR_THEME_OPTIONS,
  type AppearanceState,
  type ColorThemeId,
  type PanelStyleId,
  PANEL_STYLE_OPTIONS,
  persistAppearance,
  readAppearance,
  resetAppearance,
  type SurfaceStyleId,
  SURFACE_STYLE_OPTIONS,
  normalizeHex,
  DEFAULT_CUSTOM_HEX,
  DEFAULT_PANEL_HEX,
  DEFAULT_SURFACE_HEX,
} from '@/lib/theme'
import { useTenantScreen } from '@/lib/useTenantScreen'

const emptyAppearance = (): AppearanceState => ({
  theme: 'blue',
  primaryHex: DEFAULT_CUSTOM_HEX,
  panel: 'slate',
  panelHex: DEFAULT_PANEL_HEX,
  surface: 'light',
  surfaceHex: DEFAULT_SURFACE_HEX,
})

export default function SettingsPage() {
  const { ready, user, menus, accessToken, allowed, Forbidden } = useTenantScreen('SETTINGS')
  const [settings, setSettings] = useState<TenantSettingsView | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [appearance, setAppearance] = useState<AppearanceState>(emptyAppearance)
  const [accentDraft, setAccentDraft] = useState(DEFAULT_CUSTOM_HEX)
  const [panelDraft, setPanelDraft] = useState(DEFAULT_PANEL_HEX)
  const [surfaceDraft, setSurfaceDraft] = useState(DEFAULT_SURFACE_HEX)

  const load = useCallback(async () => {
    if (!accessToken) return
    setSettings(await apiRequest<TenantSettingsView>('/api/v1/settings', { token: accessToken }))
  }, [accessToken])

  useEffect(() => {
    if (ready && allowed) void load().catch((caught) => {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load')
    })
  }, [ready, allowed, load])

  useEffect(() => {
    const next = readAppearance()
    setAppearance(next)
    setAccentDraft(next.primaryHex)
    setPanelDraft(next.panelHex)
    setSurfaceDraft(next.surfaceHex)
  }, [])

  const syncDrafts = (next: AppearanceState) => {
    setAppearance(next)
    setAccentDraft(next.primaryHex)
    setPanelDraft(next.panelHex)
    setSurfaceDraft(next.surfaceHex)
  }

  const commitAppearance = (partial: Partial<AppearanceState>) => {
    syncDrafts(persistAppearance(partial))
  }

  const handleAccentPreset = (id: Exclude<ColorThemeId, 'custom'>) => {
    commitAppearance({ theme: id })
  }

  const handleCustomAccent = () => {
    commitAppearance({ theme: 'custom', primaryHex: normalizeHex(accentDraft) ?? DEFAULT_CUSTOM_HEX })
  }

  const handleAccentColorInput = (value: string) => {
    const normalized = normalizeHex(value) ?? DEFAULT_CUSTOM_HEX
    setAccentDraft(normalized)
    commitAppearance({ theme: 'custom', primaryHex: normalized })
  }

  const handleAccentHexBlur = () => {
    const normalized = normalizeHex(accentDraft)
    if (!normalized) {
      setAccentDraft(appearance.primaryHex)
      return
    }
    commitAppearance({ theme: 'custom', primaryHex: normalized })
  }

  const handlePanelPreset = (id: Exclude<PanelStyleId, 'custom'>) => {
    commitAppearance({ panel: id })
  }

  const handleCustomPanel = () => {
    commitAppearance({ panel: 'custom', panelHex: normalizeHex(panelDraft) ?? DEFAULT_PANEL_HEX })
  }

  const handlePanelColorInput = (value: string) => {
    const normalized = normalizeHex(value) ?? DEFAULT_PANEL_HEX
    setPanelDraft(normalized)
    commitAppearance({ panel: 'custom', panelHex: normalized })
  }

  const handlePanelHexBlur = () => {
    const normalized = normalizeHex(panelDraft)
    if (!normalized) {
      setPanelDraft(appearance.panelHex)
      return
    }
    commitAppearance({ panel: 'custom', panelHex: normalized })
  }

  const handleSurfacePreset = (id: Exclude<SurfaceStyleId, 'custom'>) => {
    commitAppearance({ surface: id })
  }

  const handleCustomSurface = () => {
    commitAppearance({
      surface: 'custom',
      surfaceHex: normalizeHex(surfaceDraft) ?? DEFAULT_SURFACE_HEX,
    })
  }

  const handleSurfaceColorInput = (value: string) => {
    const normalized = normalizeHex(value) ?? DEFAULT_SURFACE_HEX
    setSurfaceDraft(normalized)
    commitAppearance({ surface: 'custom', surfaceHex: normalized })
  }

  const handleSurfaceHexBlur = () => {
    const normalized = normalizeHex(surfaceDraft)
    if (!normalized) {
      setSurfaceDraft(appearance.surfaceHex)
      return
    }
    commitAppearance({ surface: 'custom', surfaceHex: normalized })
  }

  const handleResetAppearance = () => {
    syncDrafts(resetAppearance())
  }

  const handleSave = async () => {
    if (!accessToken || !settings) return
    setError(null)
    setSaved(false)
    try {
      const next = await apiRequest<TenantSettingsView>('/api/v1/settings', {
        method: 'PATCH',
        token: accessToken,
        body: {
          require_banking_approval: settings.require_banking_approval,
          hawala_approval_above_minor: settings.hawala_approval_above_minor,
          allow_negative_margin: settings.allow_negative_margin,
          confirmation: confirmation || undefined,
        },
      })
      setSettings(next)
      setConfirmation('')
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not save')
    }
  }

  if (!ready || !user) return <p className="p-3 text-xs text-zinc-500">Loading</p>
  if (!allowed) return Forbidden
  if (!settings) return <p className="p-3 text-xs text-zinc-500">Loading</p>

  const customAccent = appearance.theme === 'custom'
  const customPanel = appearance.panel === 'custom'
  const customSurface = appearance.surface === 'custom'
  const liveAccent = accentHexForTheme(appearance.theme, appearance.primaryHex)

  return (
    <AppShell title="Settings" role={user.role} menus={menus}>
      <PageHeader title="Tenant Settings" />
      <div className="mb-4">
        {saved ? <ErrorAlert message="Settings saved successfully" type="success" /> : null}
        <ErrorAlert message={error} />
      </div>
      <FormShell submitLabel="Save Settings" onSubmit={() => void handleSave()}>
        <FormSection title="Configuration" description="General platform rules and limits.">
          <FormGrid>
            <FormField label="Require banking approval">
              <div className="flex h-10 items-center px-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                  checked={settings.require_banking_approval}
                  onChange={(event) => setSettings({ ...settings, require_banking_approval: event.target.checked })}
                />
              </div>
            </FormField>
            <FormField label="Hawala approval above (paise)">
              <Input
                type="number"
                value={settings.hawala_approval_above_minor}
                onChange={(event) => setSettings({ ...settings, hawala_approval_above_minor: Number(event.target.value) })}
              />
            </FormField>
            <FormField label="Allow negative margin">
              <div className="flex h-10 items-center px-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                  checked={settings.allow_negative_margin}
                  onChange={(event) => setSettings({ ...settings, allow_negative_margin: event.target.checked })}
                />
              </div>
            </FormField>
            {settings.allow_negative_margin ? (
              <FormField label="Type ALLOW_NEGATIVE_MARGIN to confirm" required>
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </FormField>
            ) : null}
          </FormGrid>
        </FormSection>
      </FormShell>

      <div
        className="mt-6 rounded-lg border p-4"
        style={{ borderColor: 'var(--qp-border)', backgroundColor: 'var(--qp-card)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              Appearance
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
              Accent, sidebar panel, and content surface each have their own colors. Applies in this browser only.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAppearance}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: 'var(--qp-card)' }}
            aria-label="Reset appearance to defaults"
          >
            Reset defaults
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
            Accent
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
            {COLOR_THEME_OPTIONS.map((option) => {
              const selected = appearance.theme === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => handleAccentPreset(option.id)}
                  className="flex min-w-[6.5rem] items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm"
                  style={{
                    borderColor: selected ? 'var(--qp-primary)' : 'var(--qp-border)',
                    backgroundColor: selected ? 'var(--qp-primary-light)' : 'var(--qp-card)',
                    boxShadow: selected ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                    color: 'var(--qp-text-primary)',
                  }}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: option.swatch }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={customAccent}
              aria-label="Custom accent"
              onClick={handleCustomAccent}
              className="flex min-w-[6.5rem] items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm"
              style={{
                borderColor: customAccent ? 'var(--qp-primary)' : 'var(--qp-border)',
                backgroundColor: customAccent ? 'var(--qp-primary-light)' : 'var(--qp-card)',
                boxShadow: customAccent ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                color: 'var(--qp-text-primary)',
              }}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border"
                style={{ backgroundColor: liveAccent, borderColor: 'var(--qp-border)' }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">Custom</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Picker</span>
              <input
                type="color"
                value={normalizeHex(accentDraft) ?? DEFAULT_CUSTOM_HEX}
                onChange={(event) => handleAccentColorInput(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                style={{ borderColor: 'var(--qp-border)' }}
                aria-label="Custom accent color picker"
              />
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Hex</span>
              <input
                type="text"
                value={accentDraft}
                onChange={(event) => setAccentDraft(event.target.value)}
                onBlur={handleAccentHexBlur}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAccentHexBlur()
                  }
                }}
                maxLength={7}
                spellCheck={false}
                className="h-9 w-[7.5rem] rounded-md border px-2 font-mono text-sm"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: 'var(--qp-card)',
                  color: 'var(--qp-text-primary)',
                }}
                aria-label="Custom accent hex"
                placeholder="#2563eb"
              />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
            Panel
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sidebar panel style">
            {PANEL_STYLE_OPTIONS.map((option) => {
              const selected = appearance.panel === option.id
              const previewActive =
                option.id === 'brand' || option.id === 'light' ? liveAccent : option.previewActive
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => handlePanelPreset(option.id)}
                  className="w-[7.5rem] overflow-hidden rounded-md border text-left"
                  style={{
                    borderColor: selected ? 'var(--qp-primary)' : 'var(--qp-border)',
                    boxShadow: selected ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                    backgroundColor: 'var(--qp-card)',
                  }}
                >
                  <div className="flex h-10" aria-hidden="true">
                    <div className="w-8" style={{ backgroundColor: option.previewBg }}>
                      <div
                        className="mx-1 mt-2 h-5 rounded-sm"
                        style={{ backgroundColor: previewActive }}
                      />
                    </div>
                    <div className="flex-1" style={{ backgroundColor: 'var(--qp-surface)' }} />
                  </div>
                  <p className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--qp-text-primary)' }}>
                    {option.label}
                  </p>
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={customPanel}
              aria-label="Custom panel"
              onClick={handleCustomPanel}
              className="w-[7.5rem] overflow-hidden rounded-md border text-left"
              style={{
                borderColor: customPanel ? 'var(--qp-primary)' : 'var(--qp-border)',
                boxShadow: customPanel ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                backgroundColor: 'var(--qp-card)',
              }}
            >
              <div className="flex h-10" aria-hidden="true">
                <div className="w-8" style={{ backgroundColor: appearance.panelHex }}>
                  <div
                    className="mx-1 mt-2 h-5 rounded-sm"
                    style={{ backgroundColor: liveAccent }}
                  />
                </div>
                <div className="flex-1" style={{ backgroundColor: 'var(--qp-surface)' }} />
              </div>
              <p className="px-2 py-1.5 text-xs font-medium" style={{ color: 'var(--qp-text-primary)' }}>
                Custom
              </p>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Picker</span>
              <input
                type="color"
                value={normalizeHex(panelDraft) ?? DEFAULT_PANEL_HEX}
                onChange={(event) => handlePanelColorInput(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                style={{ borderColor: 'var(--qp-border)' }}
                aria-label="Custom panel color picker"
              />
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Hex</span>
              <input
                type="text"
                value={panelDraft}
                onChange={(event) => setPanelDraft(event.target.value)}
                onBlur={handlePanelHexBlur}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handlePanelHexBlur()
                  }
                }}
                maxLength={7}
                spellCheck={false}
                className="h-9 w-[7.5rem] rounded-md border px-2 font-mono text-sm"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: 'var(--qp-card)',
                  color: 'var(--qp-text-primary)',
                }}
                aria-label="Custom panel hex"
                placeholder="#0f172a"
              />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--qp-text-muted)' }}>
            Surface
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Content surface style">
            {SURFACE_STYLE_OPTIONS.map((option) => {
              const selected = appearance.surface === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => handleSurfacePreset(option.id)}
                  className="rounded-md border px-3 py-2 text-xs font-medium"
                  style={{
                    borderColor: selected ? 'var(--qp-primary)' : 'var(--qp-border)',
                    backgroundColor: selected ? 'var(--qp-primary-light)' : 'var(--qp-card)',
                    boxShadow: selected ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                    color: 'var(--qp-text-primary)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={customSurface}
              aria-label="Custom surface"
              onClick={handleCustomSurface}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium"
              style={{
                borderColor: customSurface ? 'var(--qp-primary)' : 'var(--qp-border)',
                backgroundColor: customSurface ? 'var(--qp-primary-light)' : 'var(--qp-card)',
                boxShadow: customSurface ? '0 0 0 2px var(--qp-primary-ring)' : undefined,
                color: 'var(--qp-text-primary)',
              }}
            >
              <span
                className="h-3.5 w-3.5 rounded-sm border"
                style={{ backgroundColor: appearance.surfaceHex, borderColor: 'var(--qp-border)' }}
                aria-hidden="true"
              />
              Custom
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Picker</span>
              <input
                type="color"
                value={normalizeHex(surfaceDraft) ?? DEFAULT_SURFACE_HEX}
                onChange={(event) => handleSurfaceColorInput(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                style={{ borderColor: 'var(--qp-border)' }}
                aria-label="Custom surface color picker"
              />
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-secondary)' }}>
              <span>Hex</span>
              <input
                type="text"
                value={surfaceDraft}
                onChange={(event) => setSurfaceDraft(event.target.value)}
                onBlur={handleSurfaceHexBlur}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSurfaceHexBlur()
                  }
                }}
                maxLength={7}
                spellCheck={false}
                className="h-9 w-[7.5rem] rounded-md border px-2 font-mono text-sm"
                style={{
                  borderColor: 'var(--qp-border)',
                  backgroundColor: 'var(--qp-card)',
                  color: 'var(--qp-text-primary)',
                }}
                aria-label="Custom surface hex"
                placeholder="#f8fafc"
              />
            </label>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs">
        <a className="underline" href="/settings/extension-devices">
          Extension devices
        </a>
      </p>
    </AppShell>
  )
}
