import { useCallback, useEffect, useState } from 'react';
import { getElectron, type UpdateStatus } from '../electron';

export function UpdateBanner() {
  const electron = getElectron();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!electron) return;
    return electron.updater.onStatus(setStatus);
  }, [electron]);

  const handleDownload = useCallback(() => {
    electron?.updater.download();
  }, [electron]);

  const handleInstall = useCallback(() => {
    electron?.updater.install();
  }, [electron]);

  if (!status || dismissed) return null;

  // Only show the banner for actionable states.
  if (status.state === 'available') {
    return (
      <div className="rd-update-banner">
        <span>Version {status.version} is available.</span>
        <button className="rd-update-btn" onClick={handleDownload}>
          Download
        </button>
        <button className="rd-update-dismiss" onClick={() => setDismissed(true)} title="Dismiss">
          ×
        </button>
      </div>
    );
  }

  if (status.state === 'downloading') {
    return (
      <div className="rd-update-banner">
        <span>Downloading update… {status.percent}%</span>
        <div className="rd-update-progress">
          <div className="rd-update-progress-bar" style={{ width: `${status.percent}%` }} />
        </div>
      </div>
    );
  }

  if (status.state === 'ready') {
    return (
      <div className="rd-update-banner">
        <span>Update ready — restart to apply v{status.version}.</span>
        <button className="rd-update-btn" onClick={handleInstall}>
          Restart now
        </button>
        <button className="rd-update-dismiss" onClick={() => setDismissed(true)} title="Later">
          ×
        </button>
      </div>
    );
  }

  return null;
}
