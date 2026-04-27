"use client";

import { useState } from "react";
import { POI_PIN_COLORS } from "@/lib/poi-pin-color";

export function PoiColorPicker({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState<string>(
    defaultValue ?? POI_PIN_COLORS[0].name,
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Pin color</span>
      <input type="hidden" name="color" value={value} />
      <div className="flex gap-1">
        {POI_PIN_COLORS.map((c) => {
          const selected = c.name === value;
          return (
            <button
              key={c.name}
              type="button"
              aria-label={c.name}
              aria-pressed={selected}
              onClick={() => setValue(c.name)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                selected
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-110"
              }`}
              style={{ backgroundColor: c.background }}
            />
          );
        })}
      </div>
    </div>
  );
}
