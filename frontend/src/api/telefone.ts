function soDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** Aplica a máscara (dd)9xxxx-xxxx ao que foi digitado, mesmo incompleto. */
export function formatarTelefone(texto: string): string {
  let digitos = soDigitos(texto);
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  digitos = digitos.slice(0, 11);
  if (digitos.length === 0) return "";
  let saida = `(${digitos.slice(0, 2)}`;
  if (digitos.length > 2) saida += `)${digitos.slice(2, 7)}`;
  if (digitos.length > 7) saida += `-${digitos.slice(7)}`;
  return saida;
}

/** Verdadeiro para celular completo: 11 dígitos, DDD sem zero à frente, terceiro dígito 9. */
export function telefoneValido(texto: string): boolean {
  return /^[1-9]\d9\d{8}$/.test(soDigitos(texto));
}
