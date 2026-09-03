/** Indonesian mobile numbers to a wa.me click-to-chat link (08xx -> 628xx). */
export function waLink(no: string): string {
  const digits = (no || "").replace(/\D/g, "");
  if (!digits) return "";
  const normalised = digits.startsWith("62")
    ? digits
    : digits.startsWith("0")
      ? `62${digits.slice(1)}`
      : `62${digits}`;
  return `https://wa.me/${normalised}`;
}
