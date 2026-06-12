import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser, useDeleteAccount } from "../../../hooks/useAuth";
import {
  useThemeStore,
  THEME_OPTIONS,
} from "../../../components/ThemeProvider";
import { SUPPORTED_LANGUAGES } from "../../../i18n";
import type { User } from "../../../schemas/auth";
import { PageContainer, Modal } from "../../../components/ui";

export default function SettingsView() {
  const { data: user } = useCurrentUser();

  return <SettingsViewInner user={user ?? null} />;
}

function SettingsViewInner({ user }: { user: User | null }) {
  const { t } = useTranslation("dashboard");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAccount = useDeleteAccount();

  const handleDeleteAccount = () => {
    setDeleteError(null);
    deleteAccount.mutate(undefined, {
      onError: () => {
        setDeleteError(t("settings.deleteAccountError"));
      },
    });
  };

  return (
    <PageContainer
      eyebrow={t("settings.eyebrow")}
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
    >
      {/* Profile */}
      <div className="settings-section">
        <div className="settings-section-header">
          {t("settings.profileSection")}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.displayName")}</div>
            <div className="settings-hint">{t("settings.displayNameHint")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              defaultValue={user?.display_name || ""}
              aria-label={t("settings.displayName")}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.email")}</div>
            <div className="settings-hint">{t("settings.emailHint")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              defaultValue={user?.email || ""}
              aria-label={t("settings.email")}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.githubHandle")}</div>
            <div className="settings-hint">
              {t("settings.githubHandleHint")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              defaultValue={`@${user?.email?.split("@")[0] || ""}`}
              aria-label={t("settings.githubHandle")}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <div className="settings-section-header">
          {t("settings.appearanceSection")}
        </div>
        <ThemePicker />
        <LanguagePicker />
      </div>

      {/* Template */}
      <div className="settings-section">
        <div className="settings-section-header">
          {t("settings.templateSection")}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t("settings.templateVersion")}
            </div>
            <div className="settings-hint">
              {t("settings.templateVersionHint")}
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--green)",
            }}
          >
            v2.0.0 &middot; up to date
          </span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.coverageGate")}</div>
            <div className="settings-hint">
              {t("settings.coverageGateHint")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              defaultValue="80"
              aria-label={t("settings.coverageGate")}
              style={{ width: 80, textAlign: "center" }}
              readOnly
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--gray)",
              }}
            >
              %
            </span>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.autoPromote")}</div>
            <div className="settings-hint">{t("settings.autoPromoteHint")}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              defaultChecked={false}
              aria-label={t("settings.autoPromote")}
            />
            <span className="toggle-track" />
          </label>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {t("settings.memoryCuratorModel")}
            </div>
            <div className="settings-hint">
              {t("settings.memoryCuratorModelHint")}
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--gray)",
            }}
          >
            claude-sonnet-4-5
          </span>
        </div>
      </div>

      {/* Links */}
      <div className="settings-section">
        <div className="settings-section-header">
          {t("settings.linksSection")}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.githubRepo")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              placeholder="https://github.com/..."
              aria-label={t("settings.githubRepo")}
              style={{ width: 260 }}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.youtubeChannel")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              placeholder="https://youtube.com/..."
              aria-label={t("settings.youtubeChannel")}
              style={{ width: 260 }}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.skoolCommunity")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="settings-input"
              placeholder="https://skool.com/..."
              aria-label={t("settings.skoolCommunity")}
              style={{ width: 260 }}
              readOnly
            />
            <button className="settings-btn outline">
              {t("buttons.save", { ns: "common" })}
            </button>
          </div>
        </div>
      </div>

      {/* Danger */}
      <div className="settings-section">
        <div
          className="settings-section-header"
          style={{ color: "var(--red)" }}
        >
          {t("settings.dangerZone")}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.clearMemory")}</div>
            <div className="settings-hint">{t("settings.clearMemoryHint")}</div>
          </div>
          <button className="settings-btn danger">
            {t("settings.clearMemoryBtn")}
          </button>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">{t("settings.deleteAccount")}</div>
            <div className="settings-hint">
              {t("settings.deleteAccountHint")}
            </div>
          </div>
          <button
            className="settings-btn danger"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText("");
              setDeleteError(null);
            }}
          >
            {t("settings.deleteAccountBtn")}
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal — uses the <Modal> primitive
          (E212) so focus is trapped, ESC closes, and focus returns to the
          trigger. The legacy hand-rolled role="dialog" had none of these. */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={
          <span style={{ color: "var(--red)" }}>
            {t("settings.deleteModalTitle")}
          </span>
        }
        className="modal-content"
      >
        <p id="delete-account-desc" className="modal-desc">
          {t("settings.deleteModalDesc")}
        </p>
        {deleteError && (
          <div className="modal-error" role="alert">
            {deleteError}
          </div>
        )}
        <label className="modal-label" htmlFor="delete-confirm-input">
          {t("settings.deleteModalLabel")}
        </label>
        <input
          id="delete-confirm-input"
          className="settings-input"
          style={{ width: "100%", marginBottom: 16 }}
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
        />
        <div className="modal-actions">
          <button
            className="settings-btn outline"
            onClick={() => setShowDeleteModal(false)}
          >
            {t("buttons.cancel", { ns: "common" })}
          </button>
          <button
            className="settings-btn danger"
            disabled={
              deleteConfirmText !== "DELETE" || deleteAccount.isPending
            }
            onClick={handleDeleteAccount}
          >
            {deleteAccount.isPending
              ? t("settings.deleteModalDeleting")
              : t("settings.deleteModalConfirm")}
          </button>
        </div>
      </Modal>
    </PageContainer>
  );
}

/* ── Theme Picker ── */
function ThemePicker() {
  const { t } = useTranslation("dashboard");
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{t("settings.theme")}</div>
        <div className="settings-hint">{t("settings.themeHint")}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`settings-btn outline${theme === opt.value ? " active" : ""}`}
            onClick={() => setTheme(opt.value)}
            aria-pressed={theme === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Language Picker ── */
function LanguagePicker() {
  const { t, i18n } = useTranslation("dashboard");

  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{t("settings.language")}</div>
        <div className="settings-hint">{t("settings.languageHint")}</div>
      </div>
      <div
        style={{ display: "flex", gap: 8 }}
        role="radiogroup"
        aria-label={t("settings.language")}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            className={`settings-btn outline${i18n.language === lang.code ? " active" : ""}`}
            onClick={() => i18n.changeLanguage(lang.code)}
            role="radio"
            aria-checked={i18n.language === lang.code}
            type="button"
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
