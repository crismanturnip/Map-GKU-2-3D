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

  return (
    <aside className="zone-panel" role="dialog" aria-labelledby={titleId}>
      <header className="zone-panel__header">
        <span className="zone-panel__swatch" style={{ background: zone.color }} aria-hidden="true" />
        <div className="zone-panel__heading">
          {info && <span className="zone-panel__category">{info.category}</span>}
          <h2 id={titleId}>{zone.name}</h2>
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

          <dl className="zone-panel__facts">
            <div>
              <dt>Jadwal</dt>
              <dd>{info.schedule}</dd>
            </div>
            <div>
              <dt>Jumlah stand</dt>
              <dd>{zone.standIds.length > 0 ? zone.standIds.length : "Segera diumumkan"}</dd>
            </div>
          </dl>

          <section aria-label={`Isi ${zone.name}`}>
            <h3>Isi zona</h3>
            <ul className="zone-panel__list">
              {info.highlights.map((item) => (
                <li key={item}>
                  <span className="zone-panel__bullet" style={{ background: zone.color }} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <p className="zone-panel__description">Informasi zona ini belum tersedia.</p>
      )}
    </aside>
  );
}
