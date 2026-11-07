export function isValidPhone(value: string) {
  const phone = value.trim()
  return /^\+[1-9]\d{6,14}$/.test(phone) || /^\d{7,15}$/.test(phone)
}

export function formatPhoneInput(value: string) {
  const cleaned = value.trimStart()
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '').slice(0, 15)
  }
  return cleaned.replace(/\D/g, '').slice(0, 15)
}
