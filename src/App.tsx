import { useState } from "react";
import { KExpoMap3D } from "./components/map/KExpoMap3D";
import type { StandConfig, ZoneConfig } from "./types/map";

export default function App() {
  const [lastSelection, setLastSelection] = useState("Belum ada objek dipilih");

  const handleZoneSelect = (zone: ZoneConfig | null) => {
    setLastSelection(zone ? zone.name : "Belum ada objek dipilih");
  };

  const handleStandSelect = (stand: StandConfig | null) => {
    setLastSelection(stand ? `${stand.id} · ${stand.name}` : "Belum ada objek dipilih");
  };

  return (
    <main className="app-shell">
      <KExpoMap3D
        onZoneSelect={handleZoneSelect}
        onStandSelect={handleStandSelect}
        selectionAnnouncement={lastSelection}
      />
    </main>
  );
}
