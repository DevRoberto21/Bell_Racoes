import { useLocation } from "react-router";

export function LocalAtual() {
  const local = useLocation();
  return <output data-testid="local">{local.pathname + local.search}</output>;
}
