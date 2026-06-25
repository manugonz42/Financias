/**
 * Estilo de iconos de la app y traducción emoji → Lucide.
 *
 * El almacenamiento canónico de los iconos de categoría/meta sigue siendo el
 * **emoji** (columna TEXT en `categories.icon` / `goals.icon`). En modo "linear"
 * se traduce ese emoji a su componente Lucide equivalente AL RENDERIZAR, sin
 * migrar nada. Una categoría sin mapeo cae al genérico `Circle`.
 */
import {
  Apple, ArrowLeftRight, Baby, Backpack, Bandage, Banknote, Beef, Beer, BedDouble,
  BatteryFull, Bike, Bone, BookOpen, Briefcase, Bus, CalendarClock,
  Camera, Candy, Car, Carrot, Cat, CheckCircle, Circle, CircleHelp, Clapperboard,
  ClipboardList, Coffee, Coins, CreditCard, Croissant, Dog, Donut, Download,
  Droplet, Dumbbell, FerrisWheel, FireExtinguisher, Fish, Flame, Folders,
  Footprints, Fuel, Gamepad2, Gem, Gift, Glasses, GraduationCap, Hammer, HandHeart,
  Headphones, Heart, Home, Hospital, House, IdCard, Joystick, Keyboard, KeyRound,
  Landmark, Laptop, LayoutDashboard, Lightbulb, LineChart, Minus, Mic, Monitor,
  Mountain, Mouse, Music, Package, Palette, PartyPopper, PawPrint, Pen, Pencil,
  Phone, PiggyBank, Pill, Pizza, Plane, Plug, Plus, ReceiptText, RefreshCw, Route,
  Salad, SatelliteDish, Scale, Scissors, Send, Settings, Shield, Shirt, ShoppingBag,
  ShoppingBasket, ShoppingCart, ShowerHead, Ship, Smartphone, Smile, Sofa, Soup,
  Sparkles, Sprout, SquareParking, Star, Stethoscope, Tags, Target, Tent, Ticket,
  TrainFront, TrendingDown, TrendingUp, Trophy, Tv, Umbrella, Undo2, UserRound, Users,
  Utensils, Wallet, Watch, Waves, Wifi, Wine, Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type IconStyle = "color" | "linear";

export function isIconStyle(v: unknown): v is IconStyle {
  return v === "color" || v === "linear";
}

/** Mapa emoji (clave canónica) → componente Lucide para el modo "linear". */
const EMOJI_TO_LUCIDE: Record<string, LucideIcon> = {
  // Dinero / banca
  "💰": Wallet, "💵": Banknote, "💶": Banknote, "💷": Banknote, "💴": Banknote,
  "🪙": Coins, "💳": CreditCard, "🏦": Landmark, "🏧": Banknote, "📈": TrendingUp,
  "📉": TrendingDown, "💹": LineChart, "🧾": ReceiptText, "💸": Send, "🤑": PiggyBank,
  "🪪": IdCard,
  // Comida / super
  "🛒": ShoppingCart, "🍔": Beef, "🍕": Pizza, "🌮": Utensils, "🍣": Fish, "🍜": Soup,
  "🥗": Salad, "🍝": Utensils, "🥖": Croissant, "🧀": Utensils, "🍎": Apple, "🥦": Carrot,
  "🥩": Beef, "🍷": Wine, "🍺": Beer, "☕": Coffee, "🍩": Donut, "🍫": Candy,
  // Transporte / coche
  "🚗": Car, "🚙": Car, "🏍️": Bike, "🛵": Bike, "⛽": Fuel, "🚕": Car, "🚌": Bus,
  "🚇": TrainFront, "🚆": TrainFront, "✈️": Plane, "🚲": Bike, "🛴": Bike,
  "🅿️": SquareParking, "🛣️": Route, "🚢": Ship,
  // Hogar / suministros
  "🏠": Home, "🏡": House, "🔑": KeyRound, "💡": Lightbulb, "🔌": Plug, "🚿": ShowerHead,
  "🔥": Flame, "🛋️": Sofa, "🛏️": BedDouble, "🧹": Sparkles, "🧺": ShoppingBasket,
  "🪛": Wrench, "🔨": Hammer, "🪴": Sprout, "📺": Tv, "🧯": FireExtinguisher,
  // Telefonía / tecnología
  "📱": Smartphone, "📞": Phone, "💻": Laptop, "🖥️": Monitor, "⌨️": Keyboard,
  "🖱️": Mouse, "🎧": Headphones, "📷": Camera, "🕹️": Joystick, "🎮": Gamepad2,
  "🔋": BatteryFull, "📡": SatelliteDish, "🛜": Wifi,
  // Salud / cuidado
  "💊": Pill, "🩺": Stethoscope, "🏥": Hospital, "🦷": Smile, "👓": Glasses,
  "🧴": Droplet, "💆": HandHeart, "💇": Scissors, "🧼": Droplet, "🩹": Bandage,
  // Ropa / compras
  "👕": Shirt, "👖": Shirt, "👗": Shirt, "👟": Footprints, "👞": Footprints,
  "🧥": Shirt, "🧦": Shirt, "🎒": Backpack, "👜": ShoppingBag, "💍": Gem, "⌚": Watch,
  "🛍️": ShoppingBag, "📦": Package,
  // Ocio / viajes / educación
  "🎬": Clapperboard, "🎵": Music, "🎤": Mic, "🎟️": Ticket, "🎨": Palette, "📚": BookOpen,
  "🎓": GraduationCap, "✏️": Pencil, "🏖️": Umbrella, "🏕️": Tent, "🏔️": Mountain,
  "🎡": FerrisWheel, "🎢": FerrisWheel, "⚽": Trophy, "🏋️": Dumbbell, "🎾": Dumbbell,
  "🏊": Waves, "🚴": Bike,
  // Mascotas / niños / familia
  "🐾": PawPrint, "🐶": Dog, "🐱": Cat, "🐟": Fish, "🦴": Bone, "👶": Baby, "🧸": Gift,
  "🎁": Gift, "🎈": PartyPopper, "👨‍👩‍👧": Users,
  // Impuestos / trabajo / servicios
  "🏛️": Landmark, "📋": ClipboardList, "🗂️": Folders, "🖋️": Pen, "💼": Briefcase,
  "🧑‍💼": UserRound, "🛡️": Shield, "⚖️": Scale, "🔧": Wrench, "🧰": Wrench,
  // Genéricos / símbolos
  "⭐": Star, "❤️": Heart, "✅": CheckCircle, "🔁": RefreshCw, "➕": Plus, "➖": Minus,
  "❓": CircleHelp, "🔵": Circle, "🟢": Circle, "🟡": Circle, "🟠": Circle, "🔴": Circle,
  "🟣": Circle, "⚫": Circle, "•": Circle,
  // Solo en valores semilla (no en el picker)
  "↩️": Undo2, "🎯": Target,
};

/** Componente Lucide equivalente a un emoji (o `Circle` si no hay mapeo). */
export function lucideForEmoji(emoji: string): LucideIcon {
  return EMOJI_TO_LUCIDE[emoji] ?? Circle;
}

/** Iconos Lucide de la barra lateral, por ruta (`to` del NavLink). */
export const NAV_LUCIDE: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/movimientos": ArrowLeftRight,
  "/categorizar": Tags,
  "/presupuestos": Wallet,
  "/metas": Target,
  "/programados": CalendarClock,
  "/inversiones": TrendingUp,
  "/importar": Download,
  "/ajustes": Settings,
};

/**
 * Renderiza el icono de una categoría/meta según el estilo activo. Es un
 * reemplazo directo de `<span ...>{icon}</span>`:
 * - "color": el emoji como texto (comportamiento histórico).
 * - "linear": el componente Lucide equivalente, dimensionado a `1em` para que
 *   herede el tamaño de fuente y el color (`currentColor`) del contexto.
 */
export function CategoryGlyph({
  icon,
  mode,
  className,
  style,
}: {
  icon: string;
  mode: IconStyle;
  className?: string;
  style?: CSSProperties;
}) {
  if (mode === "linear") {
    const Cmp = lucideForEmoji(icon);
    return (
      <Cmp
        className={cn("inline size-[1em] shrink-0 align-[-0.125em]", className)}
        style={style}
        aria-hidden
      />
    );
  }
  return (
    <span className={className} style={style}>
      {icon}
    </span>
  );
}
