// Pilha dos diálogos abertos: só o do topo reage a Esc, Tab e clique no véu.
const pilha: symbol[] = [];

export function empilhar(id: symbol) {
  desempilhar(id);
  pilha.push(id);
}

export function desempilhar(id: symbol) {
  const posicao = pilha.indexOf(id);
  if (posicao >= 0) pilha.splice(posicao, 1);
}

/** Há alguma gaveta ou diálogo aberto. */
export function haCamadaAberta() {
  return pilha.length > 0;
}

export function estaNoTopo(id: symbol) {
  return pilha[pilha.length - 1] === id;
}
