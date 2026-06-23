import { useState } from "react";

/** Catálogo de iconos para categorías (emojis), agrupados temáticamente. */
export const CATEGORY_ICONS: string[] = [
  // Dinero / banca
  "💰", "💵", "💶", "💷", "💴", "🪙", "💳", "🏦", "🏧", "📈", "📉", "💹", "🧾", "💸", "🤑", "🪪",
  // Comida / super
  "🛒", "🍔", "🍕", "🌮", "🍣", "🍜", "🥗", "🍝", "🥖", "🧀", "🍎", "🥦", "🥩", "🍷", "🍺", "☕", "🍩", "🍫",
  // Transporte / coche
  "🚗", "🚙", "🏍️", "🛵", "⛽", "🚕", "🚌", "🚇", "🚆", "✈️", "🚲", "🛴", "🅿️", "🛣️", "🚢",
  // Hogar / suministros
  "🏠", "🏡", "🔑", "💡", "🔌", "🚿", "🔥", "🛋️", "🛏️", "🧹", "🧺", "🪛", "🔨", "🪴", "📺", "🧯",
  // Telefonía / tecnología
  "📱", "📞", "💻", "🖥️", "⌨️", "🖱️", "🎧", "📷", "🕹️", "🎮", "🔋", "📡", "🛜",
  // Salud / cuidado
  "💊", "🩺", "🏥", "🦷", "👓", "🧴", "💆", "💇", "🧼", "🩹",
  // Ropa / compras
  "👕", "👖", "👗", "👟", "👞", "🧥", "🧦", "🎒", "👜", "💍", "⌚", "🛍️", "📦",
  // Ocio / viajes / educación
  "🎬", "🎵", "🎤", "🎟️", "🎨", "📚", "🎓", "✏️", "🏖️", "🏕️", "🏔️", "🎡", "🎢", "⚽", "🏋️", "🎾", "🏊", "🚴",
  // Mascotas / niños / familia
  "🐾", "🐶", "🐱", "🐟", "🦴", "👶", "🧸", "🎁", "🎈", "👨‍👩‍👧",
  // Impuestos / trabajo / servicios
  "🏛️", "📋", "🗂️", "🖋️", "💼", "🧑‍💼", "🛡️", "⚖️", "🔧", "🧰",
  // Genéricos / símbolos
  "⭐", "❤️", "✅", "🔁", "➕", "➖", "❓", "🔵", "🟢", "🟡", "🟠", "🔴", "🟣", "⚫", "•",
];

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Elegir icono"
        style={{ width: 48, textAlign: "center", fontSize: 18, lineHeight: 1 }}
      >
        {value || "•"}
      </button>
      {open && (
        <div className="icon-pop" style={{ flexBasis: "100%" }}>
          {CATEGORY_ICONS.map((emoji, i) => (
            <button
              type="button"
              key={`${emoji}-${i}`}
              className={`icon-cell${emoji === value ? " sel" : ""}`}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
