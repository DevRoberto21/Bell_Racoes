export type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ErroApi extends Error {
  status: number;
  campos: Record<string, string>;

  constructor(mensagem: string, status: number, campos: Record<string, string> = {}) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
    this.campos = campos;
  }
}

/** Nestes dois caminhos o 401 é a resposta normal de quem não entrou, não uma sessão que expirou. */
const SEM_SESSAO_ESPERADA = new Set(["/api/sessao", "/api/entrar"]);
const ouvintesDaSessao = new Set<() => void>();

/** Registra quem deve saber que o servidor respondeu 401 (sessão expirada); devolve a função que cancela. */
export function aoExpirarSessao(ouvinte: () => void): () => void {
  ouvintesDaSessao.add(ouvinte);
  return () => {
    ouvintesDaSessao.delete(ouvinte);
  };
}

function tokenCsrf(): string {
  const par = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="));
  return par ? decodeURIComponent(par.slice("csrftoken=".length)) : "";
}

export async function requisitar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const opcoes: RequestInit = { method: metodo, credentials: "same-origin", headers };
  if (metodo !== "GET") {
    headers["X-CSRFToken"] = tokenCsrf();
  }
  if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta: Response;
  try {
    resposta = await fetch(caminho, opcoes);
  } catch {
    throw new ErroApi("Sem conexão com o servidor.", 0);
  }

  if (resposta.status === 401 && !SEM_SESSAO_ESPERADA.has(caminho)) {
    for (const ouvinte of ouvintesDaSessao) ouvinte();
  }

  let dados: unknown;
  try {
    dados = await resposta.json();
  } catch {
    throw new ErroApi("O servidor não respondeu como esperado.", resposta.status);
  }

  if (!resposta.ok) {
    const falha = dados as { erro?: string; campos?: Record<string, string> };
    throw new ErroApi(
      falha.erro ?? "O servidor não respondeu como esperado.",
      resposta.status,
      falha.campos ?? {},
    );
  }
  return dados as T;
}
