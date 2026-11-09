import { useEffect, useRef } from "react";
import type { ZoneConfig } from "../../types/map";

interface ZoneInfoPanelProps {
  zone: ZoneConfig;
  onClose: () => void;
}

export function ZoneInfoPanel({ zone, onClose }: ZoneInfoPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = `zone-info-title-${zone.id}`;

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, [zone.id]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { info } = zone;
  const zoneEntries = info?.highlights ?? [];

  return (
    <aside className="zone-panel" role="dialog" aria-labelledby={titleId}>
      <header className="zone-panel__header">
        <span className="zone-panel__swatch" style={{ background: zone.color }} aria-hidden="true" />
        <div className="zone-panel__heading">
          {info && <span className="zone-panel__category">{info.category}</span>}
          <h2 id={titleId}>
            {zone.name} ({zoneEntries.length})
          </h2>
        </div>
        <button ref={closeButton} className="zone-panel__close" type="button" onClick={onClose} aria-label="Tutup informasi zona">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4Z" />
          </svg>
        </button>
      </header>

      {info ? (
        <div className="zone-panel__body">
          <p className="zone-panel__description">{info.description}</p>

          <section aria-label={`Isi ${zone.name}`}>
            <h3>Isi zona</h3>
            <ol className="zone-panel__list">
              {zoneEntries.map((item) => (
                <li key={item}>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <p className="zone-panel__description">Informasi zona ini belum tersedia.</p>
      )}
    </aside>
  );
}
