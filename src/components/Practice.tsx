import { useState } from "react";
import { useLang } from "../i18n";
import { BreathPacer } from "./BreathPacer";
import { BellTimer } from "./BellTimer";
import type { BedLevels } from "../types";

type Mode = "breath" | "bell";

/** The wordless-practice tab: a guided breath pacer, or an unguided bell sit. */
export function Practice({ beds, master }: { beds: BedLevels; master: number }) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("breath");

  return (
    <div>
      <div className="mb-7 flex gap-1 rounded-full bg-bark/5 p-1">
        <Seg on={mode === "breath"} onClick={() => setMode("breath")}>
          {t("Respiration", "Breath")}
        </Seg>
        <Seg on={mode === "bell"} onClick={() => setMode("bell")}>
          {t("Cloche", "Bell")}
        </Seg>
      </div>

      {mode === "breath" ? (
        <BreathPacer beds={beds} master={master} />
      ) : (
        <BellTimer beds={beds} master={master} />
      )}
    </div>
  );
}

function Seg({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap flex-1 rounded-full py-2 text-sm font-medium transition ${
        on ? "bg-linen-light text-bark shadow-soft" : "text-bark-faint hover:text-bark-soft"
      }`}
    >
      {children}
    </button>
  );
}
