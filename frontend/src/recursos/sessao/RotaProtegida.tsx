import { Navigate, Outlet, useLocation } from "react-router";
import { useSessao } from "./sessao";

export function RotaProtegida() {
  const sessao = useSessao();
  const local = useLocation();

  if (sessao.isPending) return null;
  if (!sessao.data?.usuario) {
    const depois = encodeURIComponent(local.pathname + local.search);
    return <Navigate to={`/entrar?depois=${depois}`} replace />;
  }
  return <Outlet />;
}
