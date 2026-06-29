import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Account, Category } from "../types";
import { listAccounts } from "../data/accounts";
import { listCategories } from "../data/categories";
import { getExcludeInternal, setExcludeInternal as persistExcl, getOwnerName, getTheme, setThemeSetting, getChartPalette, setChartPalette, getIconStyle, setIconStyle as persistIconStyle, type Theme } from "../data/settings";
import type { PaletteId } from "../lib/palettes";
import type { IconStyle } from "../lib/icons";

interface AppState {
  accounts: Account[];
  categories: Category[];
  ownerName: string;
  loading: boolean;
  /** Cuenta seleccionada globalmente: id numérico o "all". */
  accountId: number | "all";
  setAccountId: (a: number | "all") => void;
  excludeInternal: boolean;
  setExcludeInternal: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** True si el tema activo es una variante minimalista. */
  isMinimalist: boolean;
  /** True si el tema es oscuro (dark o minimalist-dark). */
  isDark: boolean;
  /** Paleta de gráficos global. Cada widget puede sobreescribirla. */
  palette: PaletteId;
  setPalette: (p: PaletteId) => void;
  /** Estilo de iconos global: emoji a color ("color") o Lucide outline ("linear"). */
  iconStyle: IconStyle;
  setIconStyle: (s: IconStyle) => void;
  /** Muestra un aviso breve (toast). */
  toast: (msg: string) => void;
  /** Contador que se incrementa para forzar recarga de datos tras cambios. */
  version: number;
  reload: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<number | "all">("all");
  const [excludeInternal, setExcludeInternalState] = useState(true);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [palette, setPaletteState] = useState<PaletteId>("categoria");
  const [iconStyle, setIconStyleState] = useState<IconStyle>("color");
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [accs, cats, excl, owner, th, pal, iStyle] = await Promise.all([
        listAccounts(),
        listCategories(),
        getExcludeInternal(),
        getOwnerName(),
        getTheme(),
        getChartPalette(),
        getIconStyle(),
      ]);
      if (cancelled) return;
      setAccounts(accs);
      setCategories(cats);
      setExcludeInternalState(excl);
      setOwnerName(owner);
      setThemeState(th);
      setPaletteState(pal);
      setIconStyleState(iStyle);
      document.documentElement.setAttribute("data-theme", th);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const setExcludeInternal = useCallback((v: boolean) => {
    setExcludeInternalState(v);
    void persistExcl(v);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    // Aplica el atributo de inmediato para que los gráficos lean los colores nuevos.
    document.documentElement.setAttribute("data-theme", t);
    setThemeState(t);
    void setThemeSetting(t);
    setVersion((v) => v + 1); // re-render de widgets/gráficos con el tema nuevo
  }, []);

  const isMinimalist = theme === "minimalist" || theme === "minimalist-dark";
  const isDark = theme === "dark" || theme === "minimalist-dark";

  const setPalette = useCallback((p: PaletteId) => {
    setPaletteState(p);
    void setChartPalette(p);
    setVersion((v) => v + 1); // re-render de gráficos con la paleta nueva
  }, []);

  const setIconStyle = useCallback((s: IconStyle) => {
    setIconStyleState(s);
    void persistIconStyle(s);
  }, []);

  return (
    <Ctx.Provider
      value={{
        accounts,
        categories,
        ownerName,
        loading,
        accountId,
        setAccountId,
        excludeInternal,
        setExcludeInternal,
        theme,
        setTheme,
        isMinimalist,
        isDark,
        palette,
        setPalette,
        iconStyle,
        setIconStyle,
        toast,
        version,
        reload,
      }}
    >
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return v;
}
