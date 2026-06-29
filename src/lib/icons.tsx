/**
 * Estilo de iconos de la app y traducción emoji → Lucide / Phosphor.
 *
 * El almacenamiento canónico de los iconos de categoría/meta sigue siendo el
 * **emoji** (columna TEXT en `categories.icon` / `goals.icon`). En modo "linear"
 * se traduce ese emoji a su componente Lucide equivalente AL RENDERIZAR, sin
 * migrar nada. En modo "phosphor" se usa Phosphor Icons (Bold). Una categoría
 * sin mapeo cae al genérico `Circle`.
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
import {
  AppleLogo as PhApple, Baby as PhBaby, Backpack as PhBackpack,
  FirstAid as PhBandage, Money as PhMoney,
  BeerStein as PhBeer, Bed as PhBed, BatteryFull as PhBatteryFull, Bicycle as PhBicycle, Bone as PhBone,
  BookOpen as PhBookOpen, Briefcase as PhBriefcase, Bus as PhBus,
  Camera as PhCamera, Cookie as PhCandy, Car as PhCar, Carrot as PhCarrot, Cat as PhCat,
  CheckCircle as PhCheckCircle, Circle as PhCircle, Question as PhQuestion, FilmStrip as PhClapperboard,
  ClipboardText as PhClipboardText, Coffee as PhCoffee, Coins as PhCoins, CreditCard as PhCreditCard,
  CookingPot as PhCroissant, Dog as PhDog, CircleDashed as PhDonut,
  PaintBrush as PhDroplet, Trophy as PhDumbbell, Pinwheel as PhFerrisWheel, FireExtinguisher as PhFireExtinguisher,
  Fish as PhFish, Flame as PhFlame, Folder as PhFolder, Footprints as PhFootprints,
  GasPump as PhGasPump, GameController as PhGameController, Diamond as PhGem, Gift as PhGift,
  Sunglasses as PhGlasses, GraduationCap as PhGraduationCap, Hammer as PhHammer, HandHeart as PhHandHeart,
  Headphones as PhHeadphones, Heart as PhHeart, House as PhHouse, Hospital as PhHospital,
  HouseLine as PhHouseLine, IdentificationCard as PhIdentificationCard, Joystick as PhJoystick,
  Keyboard as PhKeyboard, Key as PhKey, Buildings as PhLandmark, Laptop as PhLaptop,
  ChartLineUp as PhChartLineUp, Lightbulb as PhLightbulb, Minus as PhMinus,
  Microphone as PhMicrophone, Monitor as PhMonitor, Mountains as PhMountain, Mouse as PhMouse,
  MusicNote as PhMusicNote, Package as PhPackage, Palette as PhPalette, Confetti as PhPartyPopper,
  PawPrint as PhPawPrint, Pen as PhPen, Pencil as PhPencil, Phone as PhPhone,
  PiggyBank as PhPiggyBank, Pill as PhPill, Pizza as PhPizza, AirplaneLanding as PhAirplaneLanding,
  Plug as PhPlug, Plus as PhPlus, Receipt as PhReceipt, ArrowClockwise as PhArrowClockwise,
  MapPin as PhMapPin, Scissors as PhScissors, PaperPlaneRight as PhPaperPlaneRight,
  Shield as PhShield, TShirt as PhShirt, ShoppingBag as PhShoppingBag, Basket as PhShoppingBasket,
  ShoppingCart as PhShoppingCart, Shower as PhShower, Boat as PhShip, DeviceMobile as PhSmartphone,
  Smiley as PhSmiley, Couch as PhCouch, BowlSteam as PhSoup, Sparkle as PhSparkle,
  Plant as PhPlant, Park as PhParkingSquare, Star as PhStar, Stethoscope as PhStethoscope,
  Target as PhTarget, Tent as PhTent, Ticket as PhTicket,
  Train as PhTrain, TrendDown as PhTrendDown, Trophy as PhTrophy,
  Television as PhTelevision, Umbrella as PhUmbrella, ArrowUUpLeft as PhArrowUUpLeft,
  User as PhUser, Users as PhUsers, ForkKnife as PhForkKnife, Wallet as PhWallet,
  Watch as PhWatch, Waves as PhWaves, WifiHigh as PhWifi, Wine as PhWine, Wrench as PhWrench,
  Scales as PhScale,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type IconStyle = "color" | "linear" | "phosphor";

export function isIconStyle(v: unknown): v is IconStyle {
  return v === "color" || v === "linear" || v === "phosphor";
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

/** Mapa emoji → componente Phosphor para el modo "phosphor". */
const EMOJI_TO_PHOSPHOR: Record<string, typeof PhCircle> = {
  // Dinero / banca
  "💰": PhWallet, "💵": PhMoney, "💶": PhMoney, "💷": PhMoney, "💴": PhMoney,
  "🪙": PhCoins, "💳": PhCreditCard, "🏦": PhLandmark, "🏧": PhMoney, "📈": PhChartLineUp,
  "📉": PhTrendDown, "💹": PhChartLineUp, "🧾": PhReceipt, "💸": PhPaperPlaneRight, "🤑": PhPiggyBank,
  "🪪": PhIdentificationCard,
  // Comida / super
  "🛒": PhShoppingCart, "🍔": PhForkKnife, "🍕": PhPizza, "🌮": PhForkKnife, "🍣": PhFish,
  "🍜": PhSoup, "🥗": PhForkKnife, "🍝": PhForkKnife, "🥖": PhCroissant, "🧀": PhForkKnife,
  "🍎": PhApple, "🥦": PhCarrot, "🥩": PhForkKnife, "🍷": PhWine, "🍺": PhBeer,
  "☕": PhCoffee, "🍩": PhDonut, "🍫": PhCandy,
  // Transporte / coche
  "🚗": PhCar, "🚙": PhCar, "🏍️": PhBicycle, "🛵": PhBicycle, "⛽": PhGasPump,
  "🚕": PhCar, "🚌": PhBus, "🚇": PhTrain, "🚆": PhTrain, "✈️": PhAirplaneLanding,
  "🚲": PhBicycle, "🛴": PhBicycle, "🅿️": PhParkingSquare, "🛣️": PhMapPin, "🚢": PhShip,
  // Hogar / suministros
  "🏠": PhHouse, "🏡": PhHouseLine, "🔑": PhKey, "💡": PhLightbulb, "🔌": PhPlug,
  "🚿": PhShower, "🔥": PhFlame, "🛋️": PhCouch, "🛏️": PhBed, "🧹": PhSparkle,
  "🧺": PhShoppingBasket, "🪛": PhWrench, "🔨": PhHammer, "🪴": PhPlant,
  "📺": PhTelevision, "🧯": PhFireExtinguisher,
  // Telefonía / tecnología
  "📱": PhSmartphone, "📞": PhPhone, "💻": PhLaptop, "🖥️": PhMonitor, "⌨️": PhKeyboard,
  "🖱️": PhMouse, "🎧": PhHeadphones, "📷": PhCamera, "🕹️": PhJoystick, "🎮": PhGameController,
  "🔋": PhBatteryFull, "📡": PhWifi, "🛜": PhWifi,
  // Salud / cuidado
  "💊": PhPill, "🩺": PhStethoscope, "🏥": PhHospital, "🦷": PhSmiley, "👓": PhGlasses,
  "🧴": PhDroplet, "💆": PhHandHeart, "💇": PhScissors, "🧼": PhDroplet, "🩹": PhBandage,
  // Ropa / compras
  "👕": PhShirt, "👖": PhShirt, "👗": PhShirt, "👟": PhFootprints, "👞": PhFootprints,
  "🧥": PhShirt, "🧦": PhShirt, "🎒": PhBackpack, "👜": PhShoppingBag, "💍": PhGem,
  "⌚": PhWatch, "🛍️": PhShoppingBag, "📦": PhPackage,
  // Ocio / viajes / educación
  "🎬": PhClapperboard, "🎵": PhMusicNote, "🎤": PhMicrophone, "🎟️": PhTicket,
  "🎨": PhPalette, "📚": PhBookOpen, "🎓": PhGraduationCap, "✏️": PhPencil,
  "🏖️": PhUmbrella, "🏕️": PhTent, "🏔️": PhMountain, "🎡": PhFerrisWheel,
  "🎢": PhFerrisWheel, "⚽": PhTrophy, "🏋️": PhDumbbell, "🎾": PhDumbbell,
  "🏊": PhWaves, "🚴": PhBicycle,
  // Mascotas / niños / familia
  "🐾": PhPawPrint, "🐶": PhDog, "🐱": PhCat, "🐟": PhFish, "🦴": PhBone,
  "👶": PhBaby, "🧸": PhGift, "🎁": PhGift, "🎈": PhPartyPopper, "👨‍👩‍👧": PhUsers,
  // Impuestos / trabajo / servicios
  "🏛️": PhLandmark, "📋": PhClipboardText, "🗂️": PhFolder, "🖋️": PhPen, "💼": PhBriefcase,
  "🧑‍💼": PhUser, "🛡️": PhShield, "⚖️": PhScale, "🔧": PhWrench, "🧰": PhWrench,
  // Genéricos / símbolos
  "⭐": PhStar, "❤️": PhHeart, "✅": PhCheckCircle, "🔁": PhArrowClockwise,
  "➕": PhPlus, "➖": PhMinus, "❓": PhQuestion,
  "🔵": PhCircle, "🟢": PhCircle, "🟡": PhCircle, "🟠": PhCircle, "🔴": PhCircle,
  "🟣": PhCircle, "⚫": PhCircle, "•": PhCircle,
  "↩️": PhArrowUUpLeft, "🎯": PhTarget,
};

/** Componente Phosphor equivalente a un emoji (o `PhCircle` si no hay mapeo). */
export function phosphorForEmoji(emoji: string): typeof PhCircle {
  return EMOJI_TO_PHOSPHOR[emoji] ?? PhCircle;
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
  if (mode === "phosphor") {
    const PhCmp = phosphorForEmoji(icon);
    return (
      <PhCmp
        className={cn("inline size-[1em] shrink-0 align-[-0.125em]", className)}
        style={style}
        weight="bold"
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
