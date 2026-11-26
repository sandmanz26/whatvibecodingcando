/**
 * Personal data that can show in a page's own text: email addresses, phone numbers and long numbers
 * (card, order or account numbers) are replaced before a label or a snapshot leaves the browser.
 */
export const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
  .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number]' : m))
