// Dinheiro e quantidade viajam como texto com ponto ("96.40"). Aqui só se manipula
// texto: nada de Number/parseFloat, para não perder precisão.

/** Converte o que a pessoa digitou ("1.234,56") em texto com ponto e `casas` decimais, ou null. */
export function paraDecimal(texto: string, casas: number): string | null {
  let limpo = texto.replace(/\s/g, "");
  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const [inteira, decimal = ""] = limpo.split(".");
  if (decimal.length > casas) return null;
  const semZeros = inteira.replace(/^0+(?=\d)/, "");
  return casas === 0 ? semZeros : `${semZeros}.${decimal.padEnd(casas, "0")}`;
}

function comMilhar(inteira: string): string {
  return inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "4812.50" vira "4.812,50". */
export function formatarDinheiro(valor: string): string {
  const [inteira, decimal] = valor.split(".");
  return decimal === undefined ? comMilhar(inteira) : `${comMilhar(inteira)},${decimal}`;
}

/** "1.500" vira "1,5"; "1.000" vira "1". */
export function formatarQuantidade(valor: string): string {
  const [inteira, decimal = ""] = valor.split(".");
  const util = decimal.replace(/0+$/, "");
  return util ? `${inteira},${util}` : inteira;
}
