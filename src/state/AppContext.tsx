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
import { getExcludeInternal, setExcludeInternal as persistExcl, getOwnerName } from "../data/settings";

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
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [accs, cats, excl, owner] = await Promise.all([
        listAccounts(),
        listCategories(),
        getExcludeInternal(),
        getOwnerName(),
      ]);
      if (cancelled) return;
      setAccounts(accs);
      setCategories(cats);
      setExcludeInternalState(excl);
      setOwnerName(owner);
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
        version,
        reload,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return v;
}
