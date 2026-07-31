import { useState } from "react";
import { MessageCircle, Settings, ExternalLink } from "lucide-react";
import { getActiveInstanceId } from "../lib/instances";
import { useTranslation } from "react-i18next";

export default function NextCloudTalk() {
  const { t } = useTranslation();
  const instanceId = getActiveInstanceId();
  const ncUrl = localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "";
  const [showSetup, setShowSetup] = useState(!ncUrl);
  const [url, setUrl] = useState(ncUrl);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const id = getActiveInstanceId();
    const cleanUrl = url.replace(/\/+$/, "");
    localStorage.setItem(`pref_${id}_nextcloud_url`, cleanUrl);
    setSaved(true);
    setShowSetup(false);
    setTimeout(() => setSaved(false), 2000);
  }

  const talkUrl = ncUrl ? `${ncUrl}/apps/spreed/` : "";

  if (!ncUrl || showSetup) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <MessageCircle className="text-purple-500" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t("nextcloud_talk.connect_title")}</h2>
              <p className="text-xs text-slate-500">{t("nextcloud_talk.setup_hint")}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.nextcloud_url_label")}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cloud.example.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">
              {t("nextcloud_talk.same_url_hint")}
            </p>
          </div>

          {saved && (
            <div className="p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">
              {t("nextcloud_talk.saved")}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!url.trim()}
            className="w-full px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm font-medium cursor-pointer"
          >
            {t("nextcloud.save_and_connect")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-4 bg-purple-50 rounded-2xl">
            <MessageCircle className="text-purple-500" size={48} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{t("settings.nextcloud_talk")}</h2>
          <p className="text-sm text-slate-500">
            {t("nextcloud_talk.description")}
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
          <p className="text-xs text-slate-400 mb-1">{t("nextcloud_talk.configured_url")}</p>
          <p className="text-sm font-mono text-slate-700 truncate">{talkUrl}</p>
        </div>

        <a
          href={talkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium transition-colors"
        >
          <ExternalLink size={16} />
          {t("nextcloud_talk.open_in_talk")}
        </a>

        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center justify-center gap-1.5 w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
        >
          <Settings size={14} />
          {t("nextcloud_talk.change_url")}
        </button>
      </div>
    </div>
  );
}
